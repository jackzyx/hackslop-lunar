import gzip
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "dem" / "LDEM_80S_80MPP_ADJ.TIF"
OUTPUT = ROOT / "web" / "public" / "surface-terrain"
TILE = 800


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with rasterio.open(SOURCE) as dem:
        assert dem.shape == (7600, 7600) and dem.res == (80, 80)
        for row in range(9):
            for col in range(9):
                values = dem.read(1, window=Window(col * TILE, row * TILE, TILE, TILE))
                assert np.isfinite(values).all()
                meters = np.rint(values).astype("<i2")
                meters[:, 1:] = np.diff(meters, axis=1)
                tile = gzip.compress(meters.tobytes(), compresslevel=9, mtime=0)
                (OUTPUT / f"{col}-{row}.bin").write_bytes(tile)


if __name__ == "__main__":
    main()
