import json
from datetime import datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
import spiceypy as sp

from horizon_mask import DEMO_SITES, MAST_M, ROOT, R_MOON_KM, DemSampler, compute_horizon


START = datetime(2025, 1, 1)
STOP = datetime(2031, 1, 1)
STEP_S = 3600
FRAME = "MOON_ME"
CORRECTION = "LT+S"
PASS_DEG = 0.01
PRECISION = 6
OUTPUT = ROOT / "web" / "src" / "mock-data.json"
SITES = [
    *DEMO_SITES,
    {"id": "C", "name": "de Gerlache Rim 2", "kind": "crater rim", "mission": "Artemis III region", "lat": -88.20, "lon": 295.6},
    {"id": "D", "name": "Haworth", "kind": "crater region", "mission": "Artemis III region", "lat": -87.45, "lon": 355.0},
    {"id": "E", "name": "Shackleton Floor (PSR)", "kind": "crater floor", "mission": "Control: permanently shadowed", "lat": -89.67, "lon": 129.8},
    {"id": "F", "name": "Nobile Rim 1", "kind": "crater rim", "mission": "Artemis III region", "lat": -85.30, "lon": 37.4},
    {"id": "G", "name": "Malapert Massif", "kind": "massif", "mission": "Artemis III region; PGDA 78 Site 23", "lat": -85.99, "lon": 359.8},
    {"id": "H", "name": "Mons Mouton (IM-2)", "kind": "plateau", "mission": "IM-2 Athena landing (6 Mar 2025)", "lat": -84.79, "lon": 29.2},
]


def moon_center_positions(body, epochs):
    return sp.spkpos(body, epochs, FRAME, CORRECTION, "MOON")[0]


def site_angles(positions, lat_deg, lon_deg, altitude_m):
    lat, lon = np.deg2rad([lat_deg, lon_deg])
    up = sp.latrec(1.0, lon, lat)
    east = np.array([-np.sin(lon), np.cos(lon), 0.0])
    north = np.cross(up, east)
    site_vector = (R_MOON_KM + altitude_m / 1000.0) * up
    direction = positions - site_vector
    e, n, u = direction @ east, direction @ north, direction @ up
    az = np.rad2deg(np.arctan2(e, n)) % 360
    el = np.rad2deg(np.arctan2(u, np.hypot(e, n)))
    return az, el


def check_horizons():
    epoch = sp.str2et("2026-11-14T12:00:00")
    for body, (ref_az, ref_el) in {"SUN": (120.525991, 1.505818), "EARTH": (358.077226, -4.021498)}.items():
        az, el = site_angles(moon_center_positions(body, epoch), -89.9, 0, 0)
        daz = abs((az - ref_az + 180) % 360 - 180) * np.cos(np.deg2rad(ref_el))
        dele = abs(el - ref_el)
        print(f"{body}: az={az:.9f}, el={el:.9f}, dAz*cos(el)={daz:.9f}, dEl={dele:.9f} deg")
        if max(daz, dele) >= PASS_DEG:
            raise ValueError(f"{body} exceeds the {PASS_DEG} deg JPL Horizons tolerance")


def build_data():
    step = timedelta(seconds=STEP_S)
    count = (STOP - START) // step
    epochs = sp.str2et([(START + i * step).isoformat() for i in range(count)])
    positions = {body: moon_center_positions(body.upper(), epochs) for body in ("sun", "earth")}
    sun_x, sun_y, sun_z = positions["sun"].T
    sub_solar_lat = np.rad2deg(np.arctan2(sun_z, np.hypot(sun_x, sun_y)))
    sub_solar_lon = np.rad2deg(np.arctan2(sun_y, sun_x)) % 360

    dem = DemSampler()
    sites, ephemerides = [], {}
    for site in SITES:
        lat, lon = site["lat"], site["lon"]
        mask, ground_h_m = compute_horizon(lat, lon, sampler=dem)
        sites.append({
            **{key: site[key] for key in ("id", "name", "kind", "mission", "lat", "lon")},
            "mast_m": MAST_M,
            "az_step_deg": 0.5,
            "horizon": mask.round(3).tolist(),
        })
        angles = {}
        for body, vectors in positions.items():
            az, el = site_angles(vectors, lat, lon, ground_h_m + MAST_M)
            angles[f"{body}_az"] = (az.round(PRECISION) % 360).tolist()
            angles[f"{body}_el"] = el.round(PRECISION).tolist()
        ephemerides[site["id"]] = angles
        print(f"{site['name']}: {count:,} hourly samples, ground elevation {ground_h_m:.1f} m")

    return {
        "mock": False,
        "note": "JPL DE440 SPICE ephemeris (LT+S), with LOLA terrain heights and horizon masks.",
        "sites": sites,
        "ephemeris": {
            "start_utc": START.isoformat(timespec="milliseconds") + "Z",
            "step_s": STEP_S,
            "count": count,
            "frame": FRAME,
            "az": "deg clockwise from north",
            "el": "deg",
            "sites": ephemerides,
        },
        "rig": {
            "sub_solar_lat": sub_solar_lat.round(PRECISION).tolist(),
            "sub_solar_lon": (sub_solar_lon.round(PRECISION) % 360).tolist(),
        },
    }


def main():
    sp.furnsh(str(ROOT / "data" / "kernels" / "lunar.tm"))
    try:
        check_horizons()
        data = build_data()
    finally:
        sp.kclear()

    with TemporaryDirectory(dir=OUTPUT.parent) as directory:
        temporary = Path(directory) / OUTPUT.name
        with temporary.open("w", encoding="utf-8") as stream:
            json.dump(data, stream, separators=(",", ":"), allow_nan=False)
        temporary.replace(OUTPUT)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
