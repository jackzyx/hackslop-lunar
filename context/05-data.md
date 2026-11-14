# Data catalog

Everything is public NASA data. Nothing in `data/` is committed. Fetch with
`scripts/fetch_data.sh [kernels|core|extra|big]`. Cite every file you use in
`references.md`. Sizes checked 13 Nov 2026.

## Terrain: LOLA south pole DEMs, PGDA product 90 (primary)

"A New View of the Lunar South Pole from LOLA", M. K. Barker et al. 2023,
https://pgda.gsfc.nasa.gov/products/90, doi:10.60903/gsfcpgda-lola-spole,
paper doi:10.3847/PSJ/acf3e1. All TIFs are **cloud-optimised GeoTIFFs** in **south
polar stereographic X/Y metres**, **MOON_ME frame of DE421**. Heights in metres
relative to the 1737.4 km sphere.

Base URL: `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/`

| File | Size | Fetch tier | Used for |
|---|---|---|---|
| `LDEM_80S_80MPP_ADJ.TIF` | 181 MB | core | Horizon masks, print mesh, on-screen shadow map |
| `LDEM_60S_240MPP_ADJ.TIF` | 210 MB | core | Far-field horizon to 300 km and beyond; custom coordinates in browser |
| `LDEM_80S_80MPP_ADJ_ERR.TIF` | 244 MB | core | Height error for the uncertainty statement |
| `LDEM_80S_80MPP_ADJ_HILL.TIF` | 85 MB | core | Polar map base layer (hillshade, 45 deg alt/az) |
| `LPSR_80S_20MPP_ADJ_1km2.{SHP,SHX,DBF,PRJ,CSV}` | ~20 MB | core | PSR outlines (>= 1 km2); V7 pass/fail for the table |
| `LDEM_80S_20MPP_ADJ.TIF` | 2.6 GB | big (avoid) | Near-field windows around curated sites. **Read over HTTP**: `rasterio.open('/vsicurl/<url>')` + window read |
| `M139356343LE_20MPP.TIF`, `M139356343_20MPP_MODEL.TIF` | | extra | LROC NAC real vs LOLA-simulated image pair (V8 stretch) |

Other products on the same page: `LDEC_*` (LOLA shot counts per pixel),
`LDEM_*_EFFRES` (effective resolution), `LDSM_*` (slope, degrees), `LDRM_*` (roughness),
`LPSR_80S_20MPP_ADJ.*` (all 506,349 PSRs, 148 MB TIF / 209 MB CSV), 10 NAC image pairs
(`M*LE_20MPP.TIF` / `M*_20MPP_MODEL.TIF`). Resolutions available: 10 m (83 S), 20/40/80 m
(80 S), 30 m (75 S), 60/120/240 m (60 S).

**Projection.** Polar stereographic, true scale at the pole, R = 1737.4 km. Get the CRS
from the file (`src.crs`), convert with pyproj. Check the x/y sign convention against
the label before trusting azimuths: plot a known crater (Shackleton centre ~89.67 S,
~129.8 E) on the hillshade.

## Terrain: site DEMs, PGDA product 78 (stretch: lander-scale horizons)

"High-Resolution LOLA Topography for Lunar South Pole Sites", Barker et al. 2021,
https://pgda.gsfc.nasa.gov/products/78, README https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/README.
5 m/px GeoTIFFs, polar stereographic, MOON_ME/DE421, pixel-registered (coords at pixel centres).
Files per site: `*_surf.tif` (height), `*_ldec.tif`, `*_toterr.tif`, `*_slp.tif`, `*_slperr.tif`, ROI shapefiles.

Sites: Site01 Connecting ridge · Site04 Shackleton rim · Site06 Nobile rim 1 ·
Site07 Peak near Shackleton · Site11 de Gerlache rim · Site20 Leibnitz beta plateau ·
Site23 Malapert massif · Haworth · Shoemaker · DM2 Nobile rim 2.
(Numbering follows Mazarico et al. 2011.) Finding: between 2024 and 2026, Site01 has the
most area with average illumination > 70 % at 1 m above the surface.

## Terrain: PDS fallback

LOLA GDR polar products on the PDS: http://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG
(`LDEM_80S_80M.IMG`, 111 MB, with `.LBL` label: expected 7,600 x 7,600 int16,
0.5 m per count, offset from a 1,737,400 m datum: **read the label**). Use only if
PGDA is slow on the night.

## Benchmark: LOLA polar illumination, PGDA product 69

https://pgda.gsfc.nasa.gov/products/69 (Mazarico et al. 2011, Icarus 211, 1066-1081,
doi:10.1016/j.icarus.2010.10.030). Average solar and Earth visibility over an 18.6-year
nutation cycle, hourly, polar stereographic, R = 1737.4 km.

| File (base `https://pgda.gsfc.nasa.gov/data/MoonIllumination/`) | Size | Use |
|---|---|---|
| `AVGVISIB_85S_060M_201608.TIF` | 34 MB | Average Sun visibility 85-90 S, 60 m. V4 benchmark |
| `AVGVISIB_85S_060M_201608_EARTH.TIF` | 23 MB | Average Earth visibility. Earth benchmark |
| `LPSR_85S_060M_201608.TIF` | 0.6 MB | PSR map at 60 m |
| `AVGVISIB_75S_120M_201608.TIF` | 79 MB | Average Sun visibility 75-90 S, 120 m. Sites between 80 and 85 S |
| `AVGVISIB_75S_120M_201608_EARTH.TIF` | 41 MB | Average Earth visibility 75-90 S |
| `LPSR_75S_120M_201608.TIF` | 1 MB | PSR map at 120 m |

The `_COG.TIF` variants linked on the page return "Not Found" (13 Nov); use the plain TIFs.
Headline numbers to reproduce: a point near Shackleton's rim sunlit continuously ~240
days a year, ~1.5 days longest total darkness.

## Ephemeris: NAIF SPICE generic kernels

Base: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/ · meta-kernel `data/kernels/lunar.tm`

| Kernel | Path | Size | Role |
|---|---|---|---|
| `naif0012.tls` | lsk/ | 5 KB | Leap seconds (UTC <-> TDB) |
| `pck00011.tpc` | pck/ | 130 KB | Body constants |
| `de440s.bsp` | spk/planets/ | 32 MB | Sun, Earth, Moon positions 1849-2150 |
| `moon_pa_de440_200625.bpc` | pck/ | 12 MB | Lunar orientation (PA frame) |
| `moon_de440_250416.tf` | fk/satellites/ | 19 KB | Defines MOON_ME / MOON_PA for DE440. **Read its comments** |
| `earth_latest_high_prec.bpc` | pck/ | 5 MB | Optional (Earth orientation; not needed for Moon-centred geometry) |

Python: SpiceyPy 8.x. Lunar frames folder: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/

## Independent check: JPL Horizons API

https://ssd-api.jpl.nasa.gov/doc/horizons.html · manual https://ssd.jpl.nasa.gov/horizons/manual.html
Endpoint `https://ssd.jpl.nasa.gov/api/horizons.api`. Lunar topocentric observer:
`CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='E-lon,lat,alt_km'`,
`QUANTITIES='4'` (apparent az/el), `ANG_FORMAT='DEG'`, `APPARENT='AIRLESS'`,
`CSV_FORMAT='YES'`. Horizons states "Center pole/equ: MEAN_ME (high precision)",
east-longitude positive, radii 1737.4 km, azimuth clockwise from north. Verified
working from this environment on 13 Nov. Browser CORS: not tested, assume no, and
precompute. Details: skill `horizons-validation`.

## Imagery and context

- LROC QuickMap (https://quickmap.lroc.asu.edu) for eyeballing sites and screenshots
  (cite LROC/ASU). NAC frame acquisition times: LROC archive (https://wms.lroc.asu.edu/lroc).
- NASA Moon Trek (https://trek.nasa.gov/moon/) as a named "existing tool" in the pitch.
- NASA Artemis III candidate landing regions (nasa.gov announcements) for site names.

## Data volume plan

Core tier ~0.75 GB. On 200-person Wi-Fi that is an hour or more. **Fetch at home, carry
on a USB stick and two laptops.** Our 13 Nov test from a cloud box ran ~0.4 MB/s from
PGDA, so do not count on PGDA being fast either.
