#!/usr/bin/env python3
"""LOLA 80 m south pole DEM -> web/public/terrain_500m.bin for the in-app shadow map.

1000 x 1000 little-endian int16, metres above the 1737.4 km sphere, 500 m pixels,
polar stereographic (R = 1737.4 km, lon 0 up, +x = 90 E), centred on the pole,
x and y from -250 to +250 km. Row 0 is the +y edge. Pixel-is-area (centres at +-0.25 km).
Each pixel is the mean of the 80 m pixels it covers.

  python scripts/export_terrain.py
"""
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

ROOT = Path(__file__).resolve().parent.parent
DEM = ROOT / "data" / "dem" / "LDEM_80S_80MPP_ADJ.TIF"
OUT = ROOT / "web" / "public" / "terrain_500m.bin"
N, HALF_M = 1000, 250_000  # keep in step with web/src/shadow.js


def main():
    with rasterio.open(DEM) as d:
        win = from_bounds(-HALF_M, -HALF_M, HALF_M, HALF_M, d.transform)
        assert abs(win.width - 2 * HALF_M / d.res[0]) < 1e-6, win  # window lands on pixel edges
        h = d.read(1, window=win, out_shape=(N, N), resampling=Resampling.average)
    assert np.isfinite(h).all(), "NaN in the DEM window"
    # Spot check: the pole sits on the corner of the 4 centre pixels; the DEM gives ~1290 m there.
    pole = h[N // 2 - 1:N // 2 + 1, N // 2 - 1:N // 2 + 1].mean()
    assert 1000 < pole < 1600, pole
    OUT.parent.mkdir(parents=True, exist_ok=True)
    np.round(h).astype("<i2").tofile(OUT)
    print(f"wrote {OUT.relative_to(ROOT)}  {OUT.stat().st_size / 2**20:.1f} MB, "
          f"{h.min():.0f} to {h.max():.0f} m, pole ~{pole:.0f} m")


if __name__ == "__main__":
    main()
