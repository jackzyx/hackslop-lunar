---
name: horizons-validation
description: Query the JPL Horizons API for Sun/Earth azimuth and elevation seen from a lunar surface site (topocentric coord@301), parse the CSV, and compare against our SPICE results; covers validation checks V1-V8, pass marks, and how to present the validation table in the app. Use whenever validating ephemeris or horizon results or building the in-app validation table.
---

# Horizons validation (Science)

Validation plan V1-V8 and pass marks: `context/04-science.md`. Gates: first
comparison before **Fri 24:00**; better than 0.05 deg by **Sat 12:00** (else ship
Horizons tables for the 8 sites and drop custom coordinates).

## The API call (verified working 13 Nov 2026)

`GET https://ssd.jpl.nasa.gov/api/horizons.api` with:

| Param | Value |
|---|---|
| `format` | `text` (or `json`, result text in `.result`) |
| `COMMAND` | `'10'` Sun, `'399'` Earth |
| `CENTER` | `'coord@301'` (topocentric site on the Moon) |
| `COORD_TYPE` | `'GEODETIC'` |
| `SITE_COORD` | `'E-lon_deg,lat_deg,alt_km'` e.g. `'0,-89.9,0'` (altitude in **km** above 1737.4 km sphere) |
| `MAKE_EPHEM` | `'YES'` |
| `EPHEM_TYPE` | `'OBSERVER'` |
| `START_TIME` / `STOP_TIME` | `'2026-11-14 00:00'` / `'2026-12-14 00:00'` (UTC) |
| `STEP_SIZE` | `'1 h'` |
| `QUANTITIES` | `'4'` (apparent azimuth and elevation) |
| `ANG_FORMAT` | `'DEG'` |
| `APPARENT` | `'AIRLESS'` |
| `CSV_FORMAT` | `'YES'` |
| `TIME_DIGITS` | `'MINUTES'` (or `SECONDS`) |

Quote string values with single quotes and URL-encode spaces. Rows sit between
`$$SOE` and `$$EOE`; CSV columns: date, solar-presence flag, lunar-presence flag,
azimuth, elevation. Header confirms `Center pole/equ : MEAN_ME (high precision)`,
east-longitude positive, radii 1737.4 km. Example row:
`2026-Nov-14 12:00,*, , 120.525991, 1.505818,` for (0, -89.9, 0).

Rate: be polite (one request per site per body; 30 days hourly = 721 rows fits one
call). Cache raw responses under `data/horizons/` (gitignored) so the app and the
re-run before the freeze work offline. Browser CORS is untested: assume no and
precompute.

Python alternative: `astroquery.jplhorizons.Horizons(id='10', location={'lon': 0,
'lat': -89.9, 'elevation': 0, 'body': 301}, epochs={...}).ephemerides(quantities='4')`
(check that astroquery passes `body=301` as topocentric lunar; compare one row with
the raw API before trusting it).

## Comparing

- Elevation: |dEl|. Azimuth: |dAz| x cos(el) (azimuth error shrinks in true angle
  near the zenith; at the pole el is tiny so this is ~|dAz|). Wrap dAz into
  (-180, 180].
- Same UTC epochs on both sides. Horizons' UTC is UTC: convert with `str2et`.
- Sites for V1: near the pole (e.g. 0 E, 89.9 S), Mons Mouton (IM-2 region), Apollo 11
  (23.473 E, 0.674 N), both Sun and Earth, 30 days hourly.
- Report: max and RMS per site per body. Pass < 0.01 deg; aim < 0.001 deg.
- If it fails, use the debugging table in the `lunar-ephemeris` skill. Science stops
  everything else until V1 passes (gate Sat 00:00).

## The in-app validation table (never cut)

One small table, visible without clicking through: rows = 3 sites x {Sun, Earth},
columns = max |dEl|, max |dAz|cos(el), N epochs, date range, "JPL Horizons, queried
<date>". Plus one line each for V2 (flat-DEM dip test), V3 (80 m vs 240 m RMS), V4
(Mazarico/PGDA 69 benchmark), and the "not modelled" list. Re-run the whole suite on
the final build Sun 03:00-06:00 and update the numbers.
