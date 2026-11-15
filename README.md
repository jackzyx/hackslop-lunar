# Sun Shade: Lunar Landing Site Navigator

NASA Space Apps Challenge 2026, Challenge 11, built at HackAthlone 4.0 (TUS Athlone, 13-15 Nov 2026).

> For any lunar south pole site and date: how many hours of sunlight and Earth contact
> you get, and what a launch slip does to them, on screen over the real LOLA terrain.

**Live app:** https://hackslop-lunar.vercel.app/

The browser does everything at runtime. The hourly Sun/Earth ephemeris table and the
terrain horizon masks are computed once in Python and shipped as static files, so the
built app also runs offline.

## Run the app

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # static build in web/dist
```

Needs Node 20+. See [web/README.md](web/README.md) for rendering and performance notes.

## Rebuild the data (optional)

```bash
scripts/setup.sh                        # Python venv, SPICE kernels, core LOLA DEMs (~0.75 GB)
.venv/bin/python scripts/check_env.py   # must end with ALL REQUIRED CHECKS PASSED
```

Windows: `py scripts\setup.py`, then `.venv\Scripts\python scripts\check_env.py`.
Needs 64-bit Python 3.11-3.14. `scripts/fetch_data.py [kernels|core|extra|big]` fetches one tier.

## Repo layout

```
web/            the app (React + Vite); static data in web/src/data and web/public
science/        ephemeris (SPICE, MOON_ME, LT+S), horizon masks, JPL Horizons validation
scripts/        setup, data download, terrain exports, browser checks
data/           fetched data (gitignored)
docs/           pitch deck and read-aloud script
```

## Data, validation and references

All public NASA data: LOLA south pole DEMs (PGDA product 90, Barker et al. 2023),
LOLA polar illumination (PGDA 69, Mazarico et al. 2011), NAIF SPICE generic kernels
(DE440), and JPL Horizons for validation. The app's Validation tab shows the Horizons
agreement, the published-result check and what is not modelled.

Every dataset, library, image and AI tool used is cited in [REFERENCES.md](REFERENCES.md).

## Licence

MIT, see [LICENSE](LICENSE).
