#!/usr/bin/env python3
"""LOLA 80 m DEM -> watertight STL of the lunar south pole on its spherical cap.
1 mm = 1 km, vertical exaggeration k = 3, 3 mm flat base, pole at the centre.
A flat on the rim marks lunar 0 deg longitude (table zero). Seen from above:
+y = 0 deg lon (the flat), +x = 90 E, same layout as the polar stereographic map.

  python hardware/make_relief.py        # 150 mm disc -> data/print/relief_150mm_k3.stl
  python hardware/make_relief.py 60     # 60 mm test coupon, same scale and settings

Geometry: .claude/skills/relief-print/SKILL.md. DEM: PGDA 90 (Barker et al. 2023), MOON_ME.
"""
import sys
from pathlib import Path

import numpy as np
import rasterio
import trimesh
from pyproj import CRS, Transformer
from rasterio.windows import Window

ROOT = Path(__file__).resolve().parent.parent
DEM = ROOT / "data" / "dem" / "LDEM_80S_80MPP_ADJ.TIF"
R, K, BASE = 1737.4, 3.0, 3.0  # Moon radius km, vertical exaggeration, base mm
N = 601                        # grid points per side, odd so one vertex sits on the pole
FLAT = 0.98                    # zero-mark flat at 98 % of the radius on the +y (0 deg lon) rim


def main(diameter=150.0):
    rd = diameter / 2  # disc radius: km on the Moon = mm on the model
    # Square grid -> disc by elliptical grid mapping (the square's edge lands on the circle).
    s = np.linspace(-1, 1, N)
    a, b = np.meshgrid(s, s[::-1])
    u, v = a * np.sqrt(1 - b**2 / 2), b * np.sqrt(1 - a**2 / 2)
    # Radial squash onto a D shape: rim becomes the chord v = FLAT where it would pass it.
    r = np.hypot(u, v)
    cosphi = np.divide(v, r, out=np.zeros_like(r), where=r > 0)
    scale = FLAT / np.maximum(cosphi, FLAT)
    xs, ys = u * scale * rd * 1000, v * scale * rd * 1000  # polar stereographic metres

    with rasterio.open(DEM) as d:
        to_ll = Transformer.from_crs(d.crs, CRS.from_proj4("+proj=longlat +R=1737400 +no_defs"), always_xy=True)
        lon90, _ = to_ll.transform(1000.0, 0.0)
        assert abs(lon90 - 90) < 1e-6, f"+x should be 90 E, got {lon90}"
        px = d.res[0]
        off = int((rd * 1000 - d.bounds.right) / -px) - 2  # same offset for rows and cols (square, centred)
        size = int(2 * rd * 1000 / px) + 5
        win = Window(off, off, size, size)
        z = d.read(1, window=win).astype(np.float64)
        t = d.window_transform(win)

    # Bilinear sample at pixel centres (pixel-is-area: centre = corner + half a pixel).
    col, row = (xs - t.c) / t.a - 0.5, (ys - t.f) / t.e - 0.5
    c0, r0 = np.floor(col).astype(int), np.floor(row).astype(int)
    fc, fr = col - c0, row - r0
    h = (z[r0, c0] * (1 - fc) * (1 - fr) + z[r0, c0 + 1] * fc * (1 - fr)
         + z[r0 + 1, c0] * (1 - fc) * fr + z[r0 + 1, c0 + 1] * fc * fr) / 1000  # km
    assert np.isfinite(h).all(), "NaN in the DEM window"

    lon, lat = to_ll.transform(xs, ys)
    c, lam = np.radians(90 + lat), np.radians(lon)  # c = angular distance from the south pole
    X = (R + h) * np.sin(c) * np.sin(lam)
    Y = (R + h) * np.sin(c) * np.cos(lam)
    Z = K * ((R + h) * np.cos(c) - R)

    # Top surface: two triangles per grid quad, wound counter-clockwise from above (normals out).
    idx = np.arange(N * N).reshape(N, N)
    top = np.column_stack([X.ravel(), Y.ravel(), Z.ravel()])
    q0, q1, q2, q3 = idx[:-1, :-1].ravel(), idx[:-1, 1:].ravel(), idx[1:, 1:].ravel(), idx[1:, :-1].ravel()
    faces = [np.column_stack([q0, q2, q1]), np.column_stack([q0, q3, q2])]
    # Rim = the square grid's boundary loop, in order. Skirt straight down, then a fan base.
    ring = np.concatenate([idx[0, :-1], idx[:-1, -1], idx[-1, :0:-1], idx[:0:-1, 0]])
    zb = Z.min() - BASE
    m = len(ring)
    bot = np.column_stack([top[ring, 0], top[ring, 1], np.full(m, zb)])
    verts = np.vstack([top, bot, [[0.0, 0.0, zb]]])
    b0 = N * N + np.arange(m)
    b1, t1 = np.roll(b0, -1), np.roll(ring, -1)
    centre = np.full(m, N * N + m)
    faces += [np.column_stack([ring, t1, b1]), np.column_stack([ring, b1, b0]), np.column_stack([b0, b1, centre])]

    # Winding is set by construction (fix_normals would need networkx); volume > 0 proves it points out.
    mesh = trimesh.Trimesh(verts, np.vstack(faces), process=False)
    assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume > 0, "mesh not printable"
    ext = mesh.extents
    assert abs(ext[0] - diameter) < 1.0, f"width {ext[0]:.2f} mm, expected {diameter}"

    out = ROOT / "data" / "print" / f"relief_{diameter:g}mm_k{K:g}.stl"
    out.parent.mkdir(parents=True, exist_ok=True)
    mesh.export(out)
    print(f"wrote {out.relative_to(ROOT)}  ({out.stat().st_size / 2**20:.1f} MB, {len(mesh.faces):,} triangles)")
    print(f"size  {ext[0]:.1f} x {ext[1]:.1f} x {ext[2]:.1f} mm (x, y, z); grid ~{diameter / (N - 1):.3f} mm")
    print(f"terrain  {h.min():+.3f} to {h.max():+.3f} km (DEM height above 1737.4 km sphere)")
    print(f"pole height {h[N // 2, N // 2]:+.3f} km; cap drop at the rim {K * R * (1 - np.cos(c.max())):.2f} mm")
    print(f"zero flat on the +y rim (0 deg lon): chord {2 * rd * np.sqrt(1 - FLAT**2):.1f} mm. +x = 90 E.")


if __name__ == "__main__":
    main(*map(float, sys.argv[1:2]))
