"""Export wider LOLA terrain for the intro, without changing the planner DEM."""
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'data/dem/LDEM_60S_240MPP_ADJ.TIF'
OUTPUT = ROOT / 'web/public/terrain_approach_1500m.bin'
N, HALF_M = 1200, 900_000


def main():
    with rasterio.open(SOURCE) as source:
        assert source.bounds.left <= -HALF_M and source.bounds.right >= HALF_M
        assert source.bounds.bottom <= -HALF_M and source.bounds.top >= HALF_M
        window = from_bounds(-HALF_M, -HALF_M, HALF_M, HALF_M, source.transform)
        heights = source.read(1, window=window, out_shape=(N, N), resampling=Resampling.average)
    assert np.isfinite(heights).all(), 'Missing heights in approach terrain'
    assert 1000 < heights[N // 2 - 1:N // 2 + 1, N // 2 - 1:N // 2 + 1].mean() < 1600
    np.round(heights).astype('<i2').tofile(OUTPUT)
    print(f'{OUTPUT.relative_to(ROOT)}: {N} x {N}, 1.5 km pixels, +/-900 km')


if __name__ == '__main__':
    main()
