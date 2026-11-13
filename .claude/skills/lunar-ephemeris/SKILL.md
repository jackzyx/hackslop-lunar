---
name: lunar-ephemeris
description: Sun and Earth azimuth/elevation from a lunar surface site with SpiceyPy (MOON_ME frame, LT+S, site vector, local ENU), sub-solar/sub-Earth points that drive the twin rig, the precomputed hourly ephemeris table, and the debugging table for frame/sign/unit errors. Use for any ephemeris, frame, azimuth/elevation, sub-solar point, or "numbers don't match Horizons" work.
---

# Lunar ephemeris (Science)

Full context: `context/04-science.md`. Kernels: `data/kernels/lunar.tm` (run
`scripts/fetch_data.sh kernels` if missing). Validate every change with the
`horizons-validation` skill.

## Non-negotiables

- Frame **`MOON_ME`** (LOLA DEMs are MOON_ME/DE421; with `moon_de440_250416.tf`
  loaded MOON_ME is the DE440 mean-Earth frame). Never `MOON_PA`, never `IAU_MOON`.
  Expect ~0.03 deg (~875 m) error if you get this wrong.
- Aberration correction **`LT+S`**, observer `MOON` for the body vectors.
- Times: parse UTC with `sp.str2et('2026-11-14T12:00:00')` (returns TDB seconds).
  Never feed a UTC epoch straight in as ET (69.18 s, 0.0097 deg of Sun motion).
- Site vector: `sp.latrec(R_km, lon_rad, lat_rad)` with R = 1737.4 + DEM height
  (km!) + mast height (km!). East-positive longitude.
- Direction to body = body vector - site vector, then normalise. Skipping the
  subtraction costs Earth up to 0.26 deg; the Sun is barely affected (so the bug hides).
- Local frame: Up = site/|site|. East = normalise(Z x Up) with Z = (0,0,1).
  North = Up x East. el = asin(d.Up); az = atan2(d.East, d.North) mod 360
  (clockwise from north, Horizons convention). Undefined at exactly -90 deg lat:
  never place a site at the pole itself.
- Optional cross-check: SpiceyPy also has `sp.azlcpo` (CSPICE azlcpo_c), which
  returns az/el for an observer on a body surface. Use it as a second
  implementation, not a substitute for understanding the frame.

## Useful SpiceyPy calls

```python
import spiceypy as sp
sp.furnsh("data/kernels/lunar.tm")
et = sp.str2et("2026-11-14T12:00:00")                 # UTC string -> TDB seconds
p_sun, lt = sp.spkpos("SUN", et, "MOON_ME", "LT+S", "MOON")   # km, Moon centre -> Sun
p_earth, lt = sp.spkpos("EARTH", et, "MOON_ME", "LT+S", "MOON")
r, lon, lat = sp.reclat(p_sun)                         # sub-solar lon/lat (radians)
ets = sp.str2et("2025-01-01") + 3600.0 * np.arange(n)  # hourly grid (vectorise with spkpos(..., ets, ...))
sp.et2utc(et, "ISOC", 0)                               # back to a UTC label
```

`sp.spkpos` accepts an array of ETs and returns an (n,3) array: use it for the hourly
2025-2030 table (52,584 epochs) in one call per body.

## Rig drivers (from the same table)

- Table angle = sub-solar longitude in MOON_ME (degrees, 0-360).
- Lamp height = L * k * tan(-sub-solar latitude) relative to the pole datum, with
  L = lamp distance, k = vertical exaggeration (3). L = 3000 mm -> 157 mm/deg;
  2025-2030 sub-solar latitude spans -1.588 to +1.586 deg (so +/- 250 mm).

## Shipping format (agree with Web)

Precompute once in Python. Recommended: per hour, the unit vectors to Sun and Earth
from the Moon centre in MOON_ME plus their distances, Float32, little-endian, one
binary file (`ephem_2025_2030.bin`, ~52,584 x 8 floats = 1.7 MB) and a JSON header
(start UTC, step s, count, layout). The browser computes site az/el (subtracting the
site vector needs the distances). Alternative: per-site az/el tables (simpler JS,
no custom coordinates).

## Debugging table

| Symptom | Likely cause |
|---|---|
| Constant offset near 0.03 deg | MOON_PA or IAU_MOON instead of MOON_ME |
| Earth wrong by up to 0.26 deg, Sun fine | Site vector not subtracted |
| Azimuth mirrored | East/north swapped, or longitude sign (Horizons: east-positive, az clockwise from north) |
| Elevation off by a constant | Radius/altitude in metres where km expected |
| Azimuth off by ~0.01 deg always | UTC treated as TDB |
| Sun ~1.5 deg at pole but wrong azimuth by 180 | atan2 argument order, or North = East x Up |

## Sanity values

- 14 Nov 2026 12:00 UTC, site (0 E, 89.9 S, 0 km): Horizons gives Sun az 120.526 deg,
  el 1.5058 deg. Sub-solar lat -1.557 deg this weekend.
- Earth from the pole: within about +/- 6.9 deg elevation, +/- 8 deg azimuth wander.
- Pass mark V1: < 0.01 deg (plan); competitor bar < 0.001 deg. Aim for the latter.
