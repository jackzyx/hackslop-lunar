# data/ (not committed)

Populated by `scripts/fetch_data.sh`. Layout:

- `kernels/` NAIF SPICE kernels + `lunar.tm` meta-kernel (absolute paths; regenerate with `scripts/fetch_data.sh kernels` after moving the repo)
- `dem/` LOLA PGDA 90 GeoTIFFs (80 m, 240 m, 80 m error, 80 m hillshade)
- `psr/` permanently shadowed region shapefile (>= 1 km2)
- `illum/` PGDA 69 average Sun/Earth visibility (benchmark, `extra` tier)
- `nac/` LROC NAC real vs simulated pair (`extra` tier)
- `horizons/` cached raw Horizons responses (create as needed)

Copy this folder to a USB stick to work offline.
