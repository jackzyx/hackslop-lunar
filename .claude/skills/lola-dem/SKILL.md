---
name: lola-dem
description: Read and crop the LOLA south pole DEMs (PGDA product 90 GeoTIFFs: 80 m, 240 m, 20 m COG over HTTP, error and hillshade maps, PSR shapefiles) with rasterio and pyproj; polar stereographic <-> lat/lon; heightmap export for the print; hillshade/polar map tiles for the web app. Use for any DEM loading, projection, cropping, resampling or terrain-data question.
---

# LOLA DEMs (Science; Hardware for the heightmap)

Catalog and URLs: `context/05-data.md`. Fetch: `scripts/fetch_data.sh core`.

## Facts about the files (inspected 13 Nov 2026)

`data/dem/LDEM_80S_80MPP_ADJ.TIF`:
- CRS `+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +x_0=0 +y_0=0 +R=1737400 +units=m`
  (south polar stereographic, true scale at the pole, sphere R = 1737.4 km).
- 7600 x 7600, float32, **metres** relative to the 1737.4 km sphere, nodata = NaN.
- 80 m pixels, bounds x, y in [-304000, 304000] m (about 80 S to the pole).
- Pixel-is-area (GMT node_offset=1): coordinates of pixel centres are bounds + 40 m.
- Internal 512 x 512 tiles and overviews (2, 4, 8, 16): fast windowed and decimated reads.
- Height at the pole is ~1290 m. Range -7296 to +7026 m.
- Frame MOON_ME of DE421, matches the SPICE MOON_ME frame we use.

`LDEM_60S_240MPP_ADJ.TIF`: same projection, 240 m, out to 60 S. Use for far-field
horizon (beyond the 80 m tile, out to 300 km and beyond) and for custom coordinates
in the browser (downsample/crop before shipping).

`LDEM_80S_20MPP_ADJ.TIF` (2.6 GB): **never download at the venue**. Windowed read
over HTTP: `rasterio.open('/vsicurl/https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF')`.
Set `GDAL_HTTP_MULTIRANGE=YES`, `GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR`,
`CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.TIF` for speed. Behind the cloud proxy, GDAL needs
`CURL_CA_BUNDLE`/`SSL_CERT_FILE` pointing at the system CA bundle.

## Patterns

```python
import rasterio, numpy as np
from rasterio.windows import from_bounds
from pyproj import CRS, Transformer

src = rasterio.open("data/dem/LDEM_80S_80MPP_ADJ.TIF")
to_ll = Transformer.from_crs(src.crs, CRS.from_proj4("+proj=longlat +R=1737400 +no_defs"), always_xy=True)
to_xy = Transformer.from_crs(CRS.from_proj4("+proj=longlat +R=1737400 +no_defs"), src.crs, always_xy=True)

x, y = to_xy.transform(lon_deg, lat_deg)              # east-positive lon, lat negative in the south
win = from_bounds(-75000, -75000, 75000, 75000, src.transform)   # 150 km square on the pole
z = src.read(1, window=win)                            # metres, float32, NaN = no data
z_small = src.read(1, out_shape=(300, 300), resampling=rasterio.enums.Resampling.average, window=win)
row, col = src.index(x, y)                             # pixel of a site
```

- Bilinear sampling of h(x, y) for ray marching: use `scipy.ndimage.map_coordinates`
  on the array with fractional (row, col) = inverse affine of (x, y).
- **Do not treat x, y as true surface distance** (0.05 % off at 87.5 S, 0.8 % at 80 S).
  Convert to lat/lon (pyproj), then to 3D with R + h.
- Sanity check orientation on day one: Shackleton's centre (~89.67 S, ~129.8 E) must
  land on the crater in the hillshade. If it is mirrored, your lon sign or axis order is wrong.

## Heightmap for the print (hand to Hardware by Fri 20:45)

Crop the 150 km square (or disc) centred on the pole from the 80 m DEM, resample to
the print resolution (e.g. 0.2 mm XY at 1 mm = 1 km -> 750 x 750 px), fill NaN
(nearest or small inpaint), and save as **16-bit PNG** plus a JSON sidecar with
`{x0, y0, pixel_m, z_min_m, z_max_m, scale: "1 mm = 1 km", k: 3}` so the mesh script
can recover metres. `PIL.Image.fromarray(u16, mode="I;16")` or `imageio`.
The mesh script (skill `relief-print`) must put it on the spherical cap.

## Web map layers

- Polar map base: `LDEM_80S_80MPP_ADJ_HILL.TIF` cropped and downsampled to ~1024 px,
  saved as PNG/WebP, with the affine (x0, y0, pixel size) in JSON so the app can
  place site pins with the same projection formula
  (x = 2R tan(c/2) sin(lon), y = 2R tan(c/2) cos(lon), c = angular distance from the
  south pole, R = 1737.4 km; verified with pyproj: lat -89 lon 0 -> (0, +30324 m),
  lon 90 -> (+30324, 0), lon 180 -> (0, -30324)). So lon 0 E points up (+y, raster
  row 0), 90 E points right, and **east longitude increases clockwise** on the map and
  on the face-up print.
- PSR outlines: `data/psr/LPSR_80S_20MPP_ADJ_1km2.SHP` -> geopandas -> simplify ->
  GeoJSON in projected metres.
- Height error: `LDEM_80S_80MPP_ADJ_ERR.TIF` sampled at each site, shown, not propagated.
