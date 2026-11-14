# Long Shadow web app (mockup)

One screen: two south pole sites side by side, a launch-delay slider (-60 to +60 days),
and per site the sunlit hours in the 30 days after landing, a verdict, longest dark gap,
Earth contact hours, time to the next sunset or Earthset, a one-month strip and a 360°
horizon panorama. Static, no backend, runs offline.

```bash
cd web && npm install
npm run dev      # http://localhost:5173
npm test         # metrics unit tests (node:test, no extra deps)
npm run build    # dist/ (relative paths: any static server, USB stick, Pages subpath)
npm run mock     # regenerate src/mock-data.json and check it still tells the story
```

## Every number is fake until Science replaces `src/mock-data.json`

The screen shows a **MOCK DATA** badge. Metrics are computed in the browser
(`src/metrics.js`) from the data file, so real data drops in without UI changes if it
keeps this shape:

| Key | Shape |
|---|---|
| `sites[]` | `id`, `name`, `kind`, `mission` (mission or programme label from Story's site list, or `null`), `lat`, `lon` (deg, east-positive), `mast_m`, `az_step_deg` (0.5), `horizon` (720 skyline elevations in deg, azimuth 0, 0.5 ... 359.5 clockwise from north) |
| `ephemeris` | `start_utc`, `step_s` (3600), `count`, `frame` (`MOON_ME`), and `sites[id]` = `{sun_az, sun_el, earth_az, earth_el}`, each `count` values in deg (az clockwise from north) |
| `rig` | `start_utc`, `step_s`, `count`, `subsolar_lat`, `subsolar_lon` (deg, MOON_ME) |

The date picker is limited so that planned date ± 60 days plus the 30-day window stays
inside the table. When the hourly 2025-2030 table arrives (≈ 52,600 rows) switch to the
binary format in the `lunar-ephemeris` skill and fetch it instead of importing JSON.

Definitions used on screen: sunlit hours = sum of the visible fraction of the 0.53° disc;
dark = no part of the disc visible; Earth in view = Earth centre above the skyline (line of
sight only); verdict = first delay of 0 to 60 days whose 30-day window gets less than half
sunlight (360 of 720 h). Thresholds live at the top of `src/metrics.js`.

Table drivers: table angle = sub-solar longitude; lamp height = 3000 mm × 3 × tan(−sub-solar
latitude). The table's turning direction is fixed on the rig (see `twin-rig` skill).
