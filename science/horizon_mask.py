#!/usr/bin/env python3
"""Compute terrain horizon masks for lunar south-pole sites from LOLA DEMs.

For each of 720 azimuths (0.5 deg step, clockwise from North), ray-march outward
along the great circle to 300 km with adaptive step size (starting at 80 m, growing
2 % per step).  At each sample, read the LOLA DEM height, build the 3-D point on
the 1737.4 km Moon sphere, and compute the elevation angle from the observer (mast = 2 m).
The maximum elevation over all samples is the skyline in that direction.

Curvature is exact in 3D: the spherical geometry gives horizon dip automatically.
V2 check: on a flat (zero-height) sphere, the mask must be -sqrt(2 m / R) = -0.08694 deg
for a 2 m mast, within +/- 0.005 deg (passing check V2).

Usage:
  python science/horizon_mask.py                    # Compute demo sites & update app data
  python science/horizon_mask.py --flat-test        # Run V2 flat-terrain test only
"""
import argparse
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
import rasterio

ROOT = Path(__file__).resolve().parent.parent
DEM_80M = ROOT / "data" / "dem" / "LDEM_80S_80MPP_ADJ.TIF"
DEM_240M = ROOT / "data" / "dem" / "LDEM_60S_240MPP_ADJ.TIF"
MOCK_DATA_PATH = ROOT / "web" / "src" / "data" / "ephemeris.json"
OUT_JSON_PATH = ROOT / "web" / "src" / "data" / "horizon-masks.json"

R_MOON_KM = 1737.4     # LOLA datum sphere radius (km)
R_MOON_M = 1737400.0   # LOLA datum sphere radius (m)
N_AZ = 720             # 0.5 deg step: 0.0, 0.5, ..., 359.5 deg
MAX_RANGE_KM = 300.0   # ray-march distance (km)
MAST_M = 2.0           # observer mast height (m)
STEP_0_M = 80.0        # initial step size (m)
GROWTH_RATE = 1.02     # step size growth per step (2 %)

# 2 demo sites
DEMO_SITES = [
    {
        "id": "A",
        "slug": "connecting_ridge",
        "name": "Connecting Ridge",
        "kind": "connecting ridge",
        "mission": "Artemis III region; PGDA 78 Site 01",
        "lat": -89.46,
        "lon": 222.5,
    },
    {
        "id": "B",
        "slug": "shackleton_rim",
        "name": "Shackleton Rim",
        "kind": "crater rim",
        "mission": "Artemis III region; PGDA 78 Site 04; Chang'e 7",
        "lat": -89.77,
        "lon": 188.1,
    },
]


def build_step_distances(max_range_km=MAX_RANGE_KM, step0_m=STEP_0_M, growth=GROWTH_RATE):
    """Build array of angular step distances (radians) along great circles."""
    step_ang = (step0_m / 1000.0) / R_MOON_KM
    max_ang = max_range_km / R_MOON_KM
    steps = []
    tot = 0.0
    while tot < max_ang:
        tot += step_ang
        steps.append(min(tot, max_ang))
        step_ang *= growth
    return np.array(steps, dtype=np.float64)


class DemSampler:
    """Fast in-memory LOLA DEM height sampler (80 m primary, 240 m far-field)."""

    def __init__(self, load_240m=True):
        if not DEM_80M.exists():
            sys.exit(f"Error: 80 m DEM not found: {DEM_80M}")
        print("Loading 80 m LOLA DEM into memory...", end=" ", flush=True)
        t0 = time.time()
        with rasterio.open(DEM_80M) as ds:
            self.dem80 = ds.read(1).astype(np.float32)
            self.x0_80 = ds.transform.c   # -304000.0
            self.y0_80 = ds.transform.f   #  304000.0
            self.dx_80 = ds.transform.a   #  80.0
            self.dy_80 = ds.transform.e   # -80.0
            self.nrows80, self.ncols80 = self.dem80.shape
        print(f"done ({time.time() - t0:.2f}s, {self.ncols80}x{self.nrows80})")

        self.dem240 = None
        if load_240m and DEM_240M.exists():
            print("Loading 240 m LOLA DEM for far-field...", end=" ", flush=True)
            t0 = time.time()
            with rasterio.open(DEM_240M) as ds:
                self.dem240 = ds.read(1).astype(np.float32)
                self.x0_240 = ds.transform.c  # -931200.0
                self.y0_240 = ds.transform.f  #  931200.0
                self.dx_240 = ds.transform.a  #  240.0
                self.dy_240 = ds.transform.e  # -240.0
                self.nrows240, self.ncols240 = self.dem240.shape
            print(f"done ({time.time() - t0:.2f}s, {self.ncols240}x{self.nrows240})")

    def sample_xy_m(self, x_m, y_m):
        """Bilinear sample DEM height (metres) from stereographic (x, y) coordinates.

        x_m, y_m can be any numpy array shape.
        """
        # Pixel coordinates in 80 m DEM
        col80 = (x_m - self.x0_80) / self.dx_80
        row80 = (y_m - self.y0_80) / self.dy_80

        r0 = np.floor(row80).astype(np.int32)
        c0 = np.floor(col80).astype(np.int32)
        r1 = r0 + 1
        c1 = c0 + 1
        fr = (row80 - r0).astype(np.float32)
        fc = (col80 - c0).astype(np.float32)

        valid80 = (r0 >= 0) & (r1 < self.nrows80) & (c0 >= 0) & (c1 < self.ncols80)

        r0_c = np.clip(r0, 0, self.nrows80 - 1)
        r1_c = np.clip(r1, 0, self.nrows80 - 1)
        c0_c = np.clip(c0, 0, self.ncols80 - 1)
        c1_c = np.clip(c1, 0, self.ncols80 - 1)

        h80 = (self.dem80[r0_c, c0_c] * (1.0 - fr) * (1.0 - fc) +
               self.dem80[r0_c, c1_c] * (1.0 - fr) * fc +
               self.dem80[r1_c, c0_c] * fr * (1.0 - fc) +
               self.dem80[r1_c, c1_c] * fr * fc)

        if self.dem240 is not None and not np.all(valid80):
            col240 = (x_m - self.x0_240) / self.dx_240
            row240 = (y_m - self.y0_240) / self.dy_240

            r0_24 = np.floor(row240).astype(np.int32)
            c0_24 = np.floor(col240).astype(np.int32)
            r1_24 = r0_24 + 1
            c1_24 = c0_24 + 1
            fr24 = (row240 - r0_24).astype(np.float32)
            fc24 = (col240 - c0_24).astype(np.float32)

            r0_24c = np.clip(r0_24, 0, self.nrows240 - 1)
            r1_24c = np.clip(r1_24, 0, self.nrows240 - 1)
            c0_24c = np.clip(c0_24, 0, self.ncols240 - 1)
            c1_24c = np.clip(c1_24, 0, self.ncols240 - 1)

            h240 = (self.dem240[r0_24c, c0_24c] * (1.0 - fr24) * (1.0 - fc24) +
                    self.dem240[r0_24c, c1_24c] * (1.0 - fr24) * fc24 +
                    self.dem240[r1_24c, c0_24c] * fr24 * (1.0 - fc24) +
                    self.dem240[r1_24c, c1_24c] * fr24 * fc24)
            return np.where(valid80, h80, h240)

        return h80


def compute_horizon(lat_deg, lon_deg, sampler=None, D_ang=None, flat_test=False, mast_m=MAST_M):
    """Compute 720-direction horizon mask for a site on the Moon.

    Returns:
      mask_deg: ndarray of shape (720,), skyline elevation in degrees
      h0_m: site ground elevation in metres above 1737.4 km sphere
    """
    if D_ang is None:
        D_ang = build_step_distances()

    lat0 = np.deg2rad(lat_deg)
    lon0 = np.deg2rad(lon_deg)

    # 1. Local ENU orthonormal frame at site
    Up = np.array([np.cos(lat0) * np.cos(lon0),
                   np.cos(lat0) * np.sin(lon0),
                   np.sin(lat0)], dtype=np.float64)

    # East = normalise(Z x Up) with Z = (0, 0, 1)
    east = np.array([-Up[1], Up[0], 0.0], dtype=np.float64)
    east = east / np.linalg.norm(east)

    # North = Up x East
    north = np.cross(Up, east)

    # 2. Site ground elevation
    if flat_test:
        h0_m = 0.0
    else:
        # Site stereographic coordinates
        x0_m = 2.0 * R_MOON_M * Up[1] / (1.0 - Up[2])
        y0_m = 2.0 * R_MOON_M * Up[0] / (1.0 - Up[2])
        h0_m = float(sampler.sample_xy_m(np.array([x0_m]), np.array([y0_m]))[0])

    # 3. Ray march along great circles: 720 azimuths, shape (720, n_steps)
    az_deg = np.arange(N_AZ) * 0.5
    az_rad = np.deg2rad(az_deg)

    # Horizontal direction vector t(az) = cos(az)*North + sin(az)*East
    # (azimuth clockwise from North)
    t = (np.cos(az_rad)[:, None] * north[None, :] +
         np.sin(az_rad)[:, None] * east[None, :])  # shape (720, 3)

    # Unit vector P_hat(az, step) on unit sphere = cos(D)*Up + sin(D)*t
    cos_D = np.cos(D_ang)[None, :, None]
    sin_D = np.sin(D_ang)[None, :, None]
    P_hat = cos_D * Up[None, None, :] + sin_D * t[:, None, :]  # shape (720, n_steps, 3)

    if flat_test:
        h_sample_km = np.zeros(P_hat.shape[:2], dtype=np.float64)
    else:
        # Polar stereographic coordinates for all sample points:
        # x = 2*R*uy / (1 - uz), y = 2*R*ux / (1 - uz)
        ux = P_hat[:, :, 0]
        uy = P_hat[:, :, 1]
        uz = P_hat[:, :, 2]
        denom = 1.0 - uz
        x_pts_m = 2.0 * R_MOON_M * uy / denom
        y_pts_m = 2.0 * R_MOON_M * ux / denom

        h_sample_m = sampler.sample_xy_m(x_pts_m, y_pts_m)
        h_sample_km = h_sample_m / 1000.0

    # 4. Elevation calculation in 3D:
    # S = (R + h0 + mast) * Up
    # P = (R + h) * P_hat
    # v = P - S = (R_sample*cos(D) - R_site)*Up + (R_sample*sin(D))*t
    # v_up = R_sample * cos(D) - R_site
    # v_horiz = R_sample * sin(D)
    # elev = arctan2(v_up, v_horiz)
    # This decomposition is completely stable and avoids catastrophic numerical
    # cancellation of order (R^2 - R^2).
    R_site_km = R_MOON_KM + (h0_m + mast_m) / 1000.0
    R_sample_km = R_MOON_KM + h_sample_km

    v_up = R_sample_km * np.cos(D_ang)[None, :] - R_site_km
    v_horiz = R_sample_km * np.sin(D_ang)[None, :]
    elev_deg = np.rad2deg(np.arctan2(v_up, v_horiz))

    # Skyline elevation is the maximum over all distance steps along each ray
    mask_deg = np.max(elev_deg, axis=1)

    return mask_deg, h0_m


def run_flat_terrain_v2_test(D_ang):
    """Run V2 flat-terrain test: dip must equal -sqrt(2*m/R) = -0.08694 deg +/- 0.005 deg."""
    expected_dip = -math.degrees(math.sqrt(2.0 * (MAST_M / 1000.0) / R_MOON_KM))
    print("\n" + "=" * 60)
    print("V2 CHECK: Flat-terrain horizon dip test")
    print(f"  Theoretical horizon dip: -sqrt(2m/R) = {expected_dip:.5f}°")
    print(f"  Tolerance: ±0.005°")

    mask_flat, _ = compute_horizon(lat_deg=-89.46, lon_deg=222.5,
                                   D_ang=D_ang, flat_test=True, mast_m=MAST_M)

    min_val = float(np.min(mask_flat))
    max_val = float(np.max(mask_flat))
    mean_val = float(np.mean(mask_flat))
    max_diff = float(np.max(np.abs(mask_flat - expected_dip)))

    print(f"  Result: min = {min_val:.5f}°, max = {max_val:.5f}°, mean = {mean_val:.5f}°")
    print(f"  Max absolute deviation from theory: {max_diff:.6f}°")

    passed = max_diff <= 0.005
    if passed:
        print(f"  >>> PASS: V2 flat-terrain test PASSED (within {max_diff:.6f}° <= 0.005°)")
    else:
        print(f"  >>> FAIL: V2 flat-terrain test FAILED (deviation {max_diff:.6f}° > 0.005°)")
    print("=" * 60 + "\n")
    return passed, expected_dip, max_diff


def main():
    parser = argparse.ArgumentParser(description="Compute LOLA terrain horizon masks for lunar sites.")
    parser.add_argument("--flat-test", action="store_true", help="Run V2 flat-terrain test only")
    args = parser.parse_args()

    D_ang = build_step_distances()
    print(f"Ray-march grid: {N_AZ} azimuths (0.5° step), {len(D_ang)} distance steps up to {D_ang[-1]*R_MOON_KM:.1f} km")

    # Run V2 test first
    v2_ok, expected_dip, v2_diff = run_flat_terrain_v2_test(D_ang)
    if not v2_ok:
        sys.exit("Error: V2 flat-terrain test failed.")

    if args.flat_test:
        print("Flat-test requested only. Exiting.")
        return

    # Load LOLA DEM
    sampler = DemSampler(load_240m=True)

    # Compute masks for the demo sites
    computed_masks = {}
    for site in DEMO_SITES:
        print(f"Computing skyline for {site['name']} ({site['lat']}° S, {site['lon']}° E)...", end=" ", flush=True)
        t0 = time.time()
        mask, h0 = compute_horizon(site["lat"], site["lon"], sampler=sampler, D_ang=D_ang)
        elapsed = time.time() - t0
        mask_rounded = [round(float(v), 3) for v in mask]
        computed_masks[site["id"]] = {
            "site": site,
            "ground_h_m": round(h0, 1),
            "mask": mask_rounded,
            "min_deg": min(mask_rounded),
            "max_deg": max(mask_rounded),
            "mean_deg": round(float(np.mean(mask_rounded)), 3),
        }
        print(f"done in {elapsed:.2f}s (h0={h0:.1f}m, min={min(mask_rounded)}°, max={max(mask_rounded)}°, mean={computed_masks[site['id']]['mean_deg']}°)")

    # Update web/src/data/ephemeris.json
    if MOCK_DATA_PATH.exists():
        print(f"\nUpdating app data file: {MOCK_DATA_PATH}...")
        with open(MOCK_DATA_PATH, "r", encoding="utf-8") as f:
            app_data = json.load(f)

        # Update Site A and Site B
        for site_info in app_data.get("sites", []):
            sid = site_info.get("id")
            if sid in computed_masks:
                res = computed_masks[sid]
                site_info["name"] = res["site"]["name"]
                site_info["kind"] = res["site"]["kind"]
                site_info["mission"] = res["site"]["mission"]
                site_info["lat"] = res["site"]["lat"]
                site_info["lon"] = res["site"]["lon"]
                site_info["mast_m"] = MAST_M
                site_info["az_step_deg"] = 0.5
                site_info["horizon"] = res["mask"]
                print(f"  ✓ Updated site '{sid}': {site_info['name']} ({site_info['lat']}° S, {site_info['lon']}° E), 720 skyline values")

        with open(MOCK_DATA_PATH, "w", encoding="utf-8") as f:
            json.dump(app_data, f, separators=(",", ":"))
        print(f"  Saved {MOCK_DATA_PATH} ({MOCK_DATA_PATH.stat().st_size / 1024:.1f} KB)")

    # Also output standalone horizon-masks.json in web/src/data/
    standalone_output = []
    for sid, res in computed_masks.items():
        standalone_output.append({
            "site": sid,
            "name": res["site"]["name"],
            "mission": res["site"]["mission"],
            "lat": res["site"]["lat"],
            "lon": res["site"]["lon"],
            "mast_m": MAST_M,
            "ground_h_m": res["ground_h_m"],
            "az_step_deg": 0.5,
            "max_range_km": MAX_RANGE_KM,
            "dem": "LDEM_80S_80MPP_ADJ",
            "mask_deg": res["mask"],
        })
    with open(OUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(standalone_output, f, indent=2)
    print(f"  Saved standalone JSON: {OUT_JSON_PATH}")

    print("\nSummary of computed skylines:")
    for sid, res in computed_masks.items():
        s = res["site"]
        print(f"  - Site {sid} ({s['name']}): Lat {s['lat']}°, Lon {s['lon']}° E, Ground height {res['ground_h_m']} m")
        print(f"      Skyline range: {res['min_deg']}° to {res['max_deg']}° (mean {res['mean_deg']}°)")


if __name__ == "__main__":
    main()
