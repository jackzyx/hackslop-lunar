# Long Shadow web app

One screen: two south pole sites side by side, a launch-delay slider (-60 to +60 days),
and per site the sunlit hours in the 30 days after landing, a verdict, longest dark gap,
Earth contact hours, time to the next sunset or Earthset, a one-month strip and a 360°
horizon panorama. Below them, a true-scale map of the real terrain with the shadows at
the landing instant (`src/shadow.js`), close-up on the two chosen sites or the whole
region. Static, no backend, runs offline.

The map's terrain is `public/terrain_500m.bin` (LOLA 80 m DEM averaged to 500 m, ±250 km,
int16 metres), made by `python scripts/export_terrain.py`. Its Sun direction is rebuilt
for the landing instant from the first chosen site's Sun azimuth and elevation in the
data file. The site numbers come from the horizon masks, not from this map.

```bash
cd web && npm install
npm run dev      # http://localhost:5173
npm test         # metrics unit tests (node:test, no extra deps)
npm run build    # dist/ (relative paths: any static server, USB stick, Pages subpath)
npm run mock     # regenerate src/mock-data.json and check it still tells the story
```

## Precomputed lunar ephemeris

`src/mock-data.json` contains the hourly SPICE ephemeris and LOLA horizon masks for
the eight curated sites. The browser computes the metrics from this file and shows
the **MOCK DATA** badge when its `mock` flag is true. To restore or regenerate the
SPICE data, run `python science/lunar_ephemeris.py` from the repo root with the
kernels and the 80 m and 240 m LOLA terrain downloaded.

| Key | Shape |
|---|---|
| `sites[]` | `id`, `name`, `kind`, `mission` (mission or programme label from Story's site list, or `null`), `lat`, `lon` (deg, east-positive), `mast_m`, `az_step_deg` (0.5), `horizon` (720 skyline elevations in deg, azimuth 0, 0.5 ... 359.5 clockwise from north) |
| `ephemeris` | `start_utc`, `step_s` (3600), `count`, `frame` (`MOON_ME`), and `sites[id]` = `{sun_az, sun_el, earth_az, earth_el}`, each `count` values in deg (az clockwise from north) |
| `rig` | `sub_solar_lat` and `sub_solar_lon`, each `count` values in deg in the same hourly order, with east-positive longitude in [0, 360) |

The table covers 52,584 UTC hours from 2025-01-01 00:00 to 2030-12-31 23:00. The
observer's position includes the LOLA ground height and the 2 m mast. The SPICE
generator checks Sun and Earth against one Horizons epoch at (0° E, 89.9° S,
0 km altitude) before replacing the data.

The validation table and the header line read `src/validation.json` (Science writes it;
`null` shows as "not yet measured"): `queried` (date string), `pass_deg` (0.01), `rows[]` =
`{site, body, max_del_deg, max_daz_cos_deg, hours, start, stop}` (deg, ISO dates), and
`checks[]` = `{id, label, result}` (result is a short sentence, e.g. "0.087° dip, within 0.001°").
The header shows the worst row as "within X° of JPL Horizons", so never type numbers into the HTML.

The date picker is limited so that planned date ± 60 days plus the 30-day window stays
inside the table.

Definitions used on screen: sunlit hours = sum of the visible fraction of the 0.53° disc;
dark = no part of the disc visible; Earth in view = Earth centre above the skyline (line of
sight only); verdict = first delay of 0 to 60 days whose 30-day window gets less than half
sunlight (360 of 720 h). Thresholds live at the top of `src/metrics.js`.
