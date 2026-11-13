# Science: frames, algorithms, validation

Owner: Science. Skills: `lunar-ephemeris`, `horizons-validation`, `lola-dem`,
`horizon-mask`, `shadow-map`. Red-team with the `science-red-team` agent before each gate.

## Numbers cheat sheet (checked 13 Nov 2026 with the kernels in `data/kernels`)

| Quantity | Value | Note |
|---|---|---|
| Lunar mean radius (LOLA datum, Horizons) | 1737.4 km | sphere for local vertical |
| Sub-solar latitude range 2025-2030 | **-1.588 to +1.586 deg** | plan used 1.54 deg (axis-to-ecliptic tilt); use 1.59 for scales |
| Sub-solar latitude this weekend | **-1.557 deg** | southern summer: Sun at the pole is near its highest |
| Sun elevation at (0 E, 89.9 S), 14 Nov 12:00 UTC (Horizons, airless) | az 120.53 deg, el 1.506 deg | ready-made first V1 row |
| Sub-Earth latitude range (libration) | +/- 6.86 deg | Earth bobs ~6.7-6.9 deg in elevation at the pole |
| Sub-Earth longitude range | +/- 8.05 deg | Earth wanders ~8 deg in azimuth |
| Synodic month | 29.53 d | 1 deg of table = 1.97 h |
| TDB - UTC | 69.18 s | 0.0097 deg of Sun motion |
| MOON_ME vs MOON_PA | 0.029 deg max (~875 m on the ground) | today's frame offset 0.019 deg |
| Sun angular diameter | 0.53 deg | lit/dark test wrong when centre within 0.27 deg of skyline |
| Earth angular diameter from Moon | ~1.9 deg | |
| Horizon dip for 2 m mast | 0.087 deg | sqrt(2h/R) |
| Distance a 5 km massif clears the horizon | 132 km | sqrt(2Rh) |
| Shadow of a 5 km mountain at 1.54 deg | 186 km | the pitch opener |
| Curvature drop 75 km from the pole | 2.47 deg | bigger than the Sun's whole range |
| Sun elevation at noon in Athlone, 15 Nov | ~18 deg | 90 - 53.4 - 18.4 (declination) |

## Algorithms (from the plan, section 7)

1. **Sun and Earth directions.** SpiceyPy `spkpos` for `SUN` and `EARTH` relative to
   `MOON`, frame `MOON_ME`, correction `LT+S`, hourly. With `moon_de440_250416.tf`
   loaded, `MOON_ME` is the mean-Earth frame, the same family the LOLA products use.
   Do not use `MOON_PA` or `IAU_MOON`.
2. **Site vector and local frame.** Radius = 1737.4 km + DEM height + mast height.
   Up = radial unit vector. East = +Z cross Up (normalised). North = Up cross East.
   Direction to a body = body vector minus site vector, normalised (matters for
   Earth: skipping it costs up to 0.26 deg). Elevation = asin(d . Up);
   azimuth = atan2(d . East, d . North), clockwise from north (Horizons convention).
   At the exact pole East is undefined: never put a site at exactly -90.
3. **Horizon mask.** For each of 720 azimuths (0.5 deg), step outward along the great
   circle to 300 km. Convert each sample to 3D (lat, lon, R + h) and take its elevation
   above the site's horizontal. Keep the maximum. Step one pixel near the site,
   growing 2 % per step.
4. **Why 300 km.** A 5 km massif clears the horizon of a ground-level observer from
   132 km; polar sites sit on ridges that see further.
5. **Projection.** Convert polar stereographic x, y to lat/lon with the inverse
   projection from the product label (use pyproj with the GeoTIFF CRS). Treating x, y
   as true distance is wrong by 0.05 % at 87.5 S, 0.2 % at 85 S, 0.8 % at 80 S.
6. **Sun as a disc.** 0.53 deg across. Sample ~200 points on the disc against the mask,
   report the visible fraction.
7. **Earth.** Earth's centre above the mask plus a user-set margin (default 0 deg).

Precompute in Python, ship static files: hourly ephemeris 2025-2030 as a binary
(Float32 az/el per body per hour, or sub-solar/sub-Earth vectors to evaluate per site
in JS), masks as JSON (720 floats per site per mast height). The browser does the rest.

## Why the table casts correct shadows

Stretching height by k maps straight rays to straight rays. A shadow edge stays on the
same terrain if the light direction is stretched too. Exact for parallel light:

    e' = arctan(k tan e),    h_lamp = L k tan(-beta_sun)

e = true Sun elevation at the pole (= minus the sub-solar latitude beta_sun),
L = lamp distance. The mesh must carry the Moon's curvature, stretched by the same k:

    x = s (R + h) sin c sin(lambda)
    y = s (R + h) sin c cos(lambda)
    z = s k [ (R + h) cos c - R ]

s = 1/1,000,000, R = 1737.4 km, h = DEM height, c = angle from the pole,
lambda = longitude. Check the x, y sign convention against the product label. With the
cap in the mesh, a site 75 km from the pole gets its real 2.47 deg daily swing in Sun
elevation for free.

Lamp height above the table's pole datum = L k tan(sub-solar latitude, sign: lamp up
when the sub-solar point is south). At L = 3 m, k = 3: **+/- 250 mm** covers 2025-2030
(+/- 242 mm at the 1.54 deg tilt; 1.59 deg is the real extreme). At 2 m: +/- 167 mm.

Table angle = sub-solar longitude (MOON_ME), with lunar 0 deg longitude aligned to the
table zero mark and the lamp. Sign: check against the shadow direction on day one.

## Validation plan

| Check | Method | Pass mark |
|---|---|---|
| V1 Ephemeris | Horizons observer table, QUANTITIES 4, for 3 sites: one near the pole, Mons Mouton, Apollo 11 (0.674 N, 23.473 E). 30 days hourly, Sun and Earth | Max difference < 0.01 deg in elevation and in azimuth x cos(elevation). One public repo reports 0.007 deg |
| V2 Horizon code | Set the DEM to zero. Mask must equal minus the dip angle: 0.087 deg below horizontal for a 2 m mast | Within 0.005 deg |
| V3 Resolution | Same site, masks from 80 m and 240 m DEMs | Report the RMS difference: that is the stated horizon uncertainty |
| V4 Published result | Mazarico et al. 2011: a point near Shackleton's rim is sunlit continuously ~240 days a year, ~1.5 days longest total darkness | Same order at our best rim site; explain the gap by resolution and exact location |
| V5 Mission events | Blue Ghost Mission 1 (Mare Crisium) ran until lunar sunset on 16 Mar 2025. IM-2: lighting at target vs 250 m away, from a 20 m window | Sunset date matches. IM-2 is qualitative |
| V6 Table vs software | Fix lamp height, turn the table, note the angle where 3 pins go dark | Within 5 deg (~10 h of lunar time) |
| V7 Permanent shadow | Sweep the lamp across the full year at all table angles | Shackleton floor never lights, matching the PGDA PSR outline |
| V8 (stretch) | Real LROC NAC frame from PGDA 90, its acquisition time from the LROC archive, our render, a photo of the table | Three-panel figure |

## Debugging the ephemeris

| Symptom | Likely cause |
|---|---|
| Constant offset near 0.03 deg | MOON_PA or IAU_MOON instead of MOON_ME |
| Earth wrong by up to 0.26 deg, Sun fine | Site vector not subtracted |
| Azimuth mirrored | East and north swapped, or longitude sign. Horizons uses east-positive longitude on the Moon and azimuth clockwise from north |
| Elevation off by a constant | Site radius or altitude in metres where kilometres were expected |
| Azimuth off by ~0.01 deg always | UTC treated as TDB (69 s = 0.0097 deg of Sun motion) |

## Uncertainties to say out loud

- **Terrain.** 80 m pixels. The horizon error is what V3 measures. The Sun meets the
  skyline at a shallow angle, so 0.1 deg of horizon error can move a sunset by hours,
  sometimes days.
- **LOLA height error** is published per pixel (`_ERR` product). Show it, do not propagate it.
- **Sunlit is geometry, not watts.** No panel orientation, no thermal model, no light
  reflected from lit slopes.
- **Earth visible is line of sight.** No link budget, no ground stations, no multipath.
- **Mast height changes the answer.** State the height used on every number.
- **Local vertical** assumes a 1737.4 km sphere.
- **Not assessed:** slopes, hazards, landing safety.
- **The table.** 1 mm = 1 km, nothing under ~400 m survives the 0.4 mm nozzle. At 3 m
  the lamp spreads 1.4 deg in azimuth and 0.04 deg in true elevation across the model.
  The lamp's disc is not the Sun's. It is a teaching instrument and a regional cross-check.

## Candidate sites (to finalise Friday night; Story owns the source links)

Pick 8 that show contrast. Candidates from NASA's Artemis III candidate regions,
PGDA product 78 site DEMs and missions:

- Shackleton rim / connecting ridge (PGDA 78 Site01 connecting ridge, Site04 Shackleton rim) — Chang'e 7 target region
- Malapert massif (PGDA 78 Site23)
- Mons Mouton (IM-2 Athena landing, ~84.8 S, 2.6 E: verify exact published coordinates)
- de Gerlache rim, Haworth, Nobile rim 1/2, Peak near Cabeus B, Leibnitz beta plateau (Artemis III candidate regions)
- Shackleton floor (permanently shadowed control case)
- One equatorial reference for V1 only: Apollo 11 (0.674 N, 23.473 E)

Coordinates: take them from the PGDA 78 README, NASA's Artemis III region
announcements, and mission press kits. Record each source in `references.md`.
Never use exactly -90 deg latitude.
