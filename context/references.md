# References log

Every dataset, library, paper, image, font, music track and AI tool used, added the
moment it is used. Space Apps requires full citation; missing references can make a
project ineligible. Format: what, who, link, what we used it for.

## NASA data
- LOLA south pole DEMs and PSR maps: Barker, M. K. et al. (2023), "A New View of the Lunar South Pole from LOLA", PGDA product 90, https://pgda.gsfc.nasa.gov/products/90, doi:10.60903/gsfcpgda-lola-spole; paper doi:10.3847/PSJ/acf3e1. Used for: horizon masks, relief print, in-app shadow map (500 m, scripts/export_terrain.py), PSR overlay.
- LOLA site DEMs: Barker, M. K. et al. (2021), PSS 203, 105119, doi:10.1016/j.pss.2020.105119, PGDA product 78, https://pgda.gsfc.nasa.gov/products/78. Used for: (stretch) lander-scale horizons.
- Lunar polar illumination: Mazarico, E. et al. (2011), Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030, PGDA product 69, https://pgda.gsfc.nasa.gov/products/69. Used for: V4 benchmark.
- NAIF SPICE generic kernels (naif0012.tls, pck00011.tpc, de440s.bsp, moon_pa_de440_200625.bpc, moon_de440_250416.tf), NASA/JPL NAIF, https://naif.jpl.nasa.gov/pub/naif/generic_kernels/. Acton, C. H. (1996), PSS 44, 65-70. Used for: Sun and Earth directions.
- JPL Horizons System, https://ssd.jpl.nasa.gov/horizons/. Used for: independent validation (V1).
- [add: LROC QuickMap screenshots, NAC frames]
- Site coordinates for the 8 curated sites: see **"Site coordinates"** section below (sources [S1]–[S6]).

## Site coordinates (8 curated sites, see 04-science.md)
- [S1] PGDA Product 78 site DEMs (5 m/pixel, Barker, M. K. et al. 2021, PSS 203, 105119): https://pgda.gsfc.nasa.gov/products/78. Used for: Connecting Ridge (Site 01, 89.46° S, 222.5° E), Shackleton Rim (Site 04, 89.77° S, 188.1° E), and Malapert Massif (Site 23, 85.99° S, 359.8° E) centre coordinates.
- [S2] NASA, "NASA Identifies Candidate Regions for Landing Next Americans on Moon" (Aug 2022): https://www.nasa.gov/feature/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon. Used for: Artemis III region centre coordinates for Connecting Ridge, Shackleton Rim, de Gerlache Rim 2 (88.20° S, 295.6° E), Haworth (87.45° S, 355.0° E), Nobile Rim 1 (85.30° S, 37.4° E), and Malapert Massif.
- [S3] Wikipedia, "Chang'e 7": https://en.wikipedia.org/wiki/Chang%27e_7. Used for: linking Shackleton Rim to Chang'e 7 target site (~88.8° S, ~123.4° E near Shackleton rim).
- [S4] LPI / USRA, Lunar South Pole surface data: https://www.lpi.usra.edu/lunar/surface/. Used for: Haworth and Nobile Rim 1 centre coordinates cross-check.
- [S5] Wikipedia, "Shackleton (crater)": https://en.wikipedia.org/wiki/Shackleton_(crater). Used for: Shackleton Floor PSR control-site coordinates (89.67° S, 129.8° E).
- [S6] Wikipedia, "IM-2": https://en.wikipedia.org/wiki/IM-2. Used for: IM-2 Athena landing coordinates at Mons Mouton (84.79° S, 29.2° E).

## Facts used in the pitch
- IM-2 Athena (fact-checked 14 Nov 2026): landed 6 Mar 2025 and ended up on its side in a crater. NASA, "NASA Receives Some Data Before Intuitive Machines Ends Lunar Mission" (7 Mar 2025), https://www.nasa.gov/news-release/nasa-receives-some-data-before-intuitive-machines-ends-lunar-mission/; LROC / NASA / Arizona State University, "IM-2 Athena Seen Obliquely", https://lroc.im-ldi.com/images/1408. Used for: landing date, attitude and crater location in the pitch.
  - Miss distance needs attribution: AP (7 Mar 2025), https://apnews.com/article/88ccdbc183bfd90b7f40ad266d56ad02, reports more than 250 m, citing the company; NASA's release above instead says more than 400 m. Treat ~250 m as an early company estimate, not a settled measurement; use "off target in a crater" in the spoken pitch.
  - Surface operations lasted about 13 hours: Eric Berger, Ars Technica, "Athena landed in a dark crater where the temperature was minus 280 F" (13 Mar 2025), https://arstechnica.com/space/2025/03/athena-landed-in-a-dark-crater-where-the-temperature-was-minus-280-f/. Used for: approximate operating duration and the explanation that limited solar generation could not support both heaters and communications. This is operating duration, not the time of the public mission-end announcement.
- Chang'e 7 (fact-checked 14 Nov 2026): missed its planned 23-24 Aug 2026 launch opportunity. Mike Wall, Space.com, "Bad weather delays launch of China's historic Chang'e 7 mission to moon's south pole" (23 Aug 2026), https://www.space.com/space-exploration/launches-spacecraft/bad-weather-delays-launch-of-chinas-historic-change-7-mission-to-moons-south-pole. Reports the original Sunday 23 Aug attempt and the abandoned Monday 24 Aug retry, and quotes Xinhua's announcement that the planned window could not be used. Corroboration: AP (23 Aug 2026), https://apnews.com/article/ae23e66a64dadfdea1c7baadcc1f4da8. Used for: the pitch's launch-slip example; these reports establish the postponement, not a subsequent launch date.
- CSA rover (fact-checked 14 Nov 2026): **drop the present-tense claim that the first Canadian rover targets the south polar region.** CSA, "First Canadian rover to explore the Moon" (modified 21 Apr 2026), https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/first-canadian-rover-to-explore-the-moon.asp, confirms that it was intended to explore the lunar south pole, but now marks the project ended. If mentioned historically, say "CSA's first lunar rover project had targeted the south polar region"; do not imply it is an active upcoming mission or conflate it with the separate lunar utility rover.
- Blue Ghost Mission 1 ended at lunar sunset 16 Mar 2025: [add source]

## Software and libraries
- SpiceyPy (Annex, A. et al., JOSS 2020, doi:10.21105/joss.02050), MIT.
- NumPy, SciPy, rasterio, pyproj, trimesh, matplotlib, astroquery, geopandas.
- Vite 8.3.5 (Evan You and contributors), MIT, https://vite.dev. Used for: web app dev server and static build. No other front-end libraries (charts are hand-written SVG).
- Arduino AccelStepper (Mike McCauley), GPL.

## Media
- [fonts, icons, music]

## AI tools
- [tool, what it was used for, by whom; keep this honest and current]
- Claude Code: environment setup, data-fetch scripts, context documents (13 Nov, before the event).
- Claude Code (Claude Opus 5.5): web app mockup in `web/` (screen layout, SVG charts, metrics functions and tests, mock-data generator), Fri 13 Nov 22:40-23:30. All data in it is invented placeholder data.
- Claude Code (Claude Opus 5.5): cross-platform setup and data download (`scripts/setup.py`, `scripts/fetch_data.py`) so Windows laptops work, Sat 14 Nov 09:00-09:30.
- Claude Code (Claude Opus 5.5): relief STL script `hardware/make_relief.py` (LOLA 80 m DEM to 150 mm print on its spherical cap), added the PGDA 69 PSR and 75 S maps to the download, hackspace parts request, Sat 14 Nov 09:40-10:05. Requested by Davit.
- Claude Code (Claude Opus 5.5): in-app shadow map of the real terrain (`web/src/shadow.js`, its tests, `scripts/export_terrain.py`), replacing the hardware table demo; site-card additions (N of 720 h, Sun elevation over the skyline, mission line), Sat 14 Nov 10:15-10:40. Requested by Davit.
- Claude Code (Claude Opus 5.5): docs rewritten for the software-only plan (CLAUDE.md, README, context 03/04/06/07/08/10, the shadow-map, relief-print and twin-rig skills), Sat 14 Nov 10:30. Requested by Davit.
- Claude Code (Claude Opus 5.5): Sun and Earth bars on the site cards, validation table read from `web/src/validation.json`, GitHub Pages workflow, Sat 14 Nov 10:45. Requested by Davit.
- Claude Code (Claude Opus 5.5): STARS intro, a zoom from the Sun to the landing region drawn from the landing date and the ephemeris Sun vector (`web/src/intro.js` and its tests), Sat 14 Nov 11:00. Requested by Davit.
- Claude Code (Claude Opus 5.5): visual polish of the app (dark projector theme, site 1 | map | site 2 hero row, per-site detail cards, validation pill and table from Nicolas's `validation.json`, phone layout), Sat 14 Nov 11:05. Requested by Davit.
