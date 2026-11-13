---
name: horizon-mask
description: Compute terrain horizon masks (maximum elevation angle of the skyline at 720 azimuths) for lunar south pole sites from LOLA DEMs by great-circle ray marching to 300 km, including mast height, curvature, Sun-as-disc visible fraction and Earth visibility, and the derived metrics (sunlit hours, longest dark gap, Earth contact hours, time to sunset/Earthset). Use for horizon, skyline, sunlit/visibility, or site-metric computations, in Python or in the browser.
---

# Horizon masks and site metrics (Science; Web for the in-browser version)

Algorithm source: `context/04-science.md`. Validate with V2 (flat DEM) and V3 (80 vs 240 m).

## Mask algorithm

For a site at (lat0, lon0) with ground height h0 from the DEM and mast height m:
1. Site vector S = (R + h0 + m) * u(lat0, lon0), R = 1737.4 km; Up = u(lat0, lon0);
   East, North as in the `lunar-ephemeris` skill.
2. For each azimuth a in 0, 0.5, ..., 359.5 deg (720 values):
   - March outward along the great circle with initial bearing a. Point at angular
     distance d: standard destination-point formula on a sphere
     (lat = asin(sin lat0 cos d + cos lat0 sin d cos a),
      lon = lon0 + atan2(sin a sin d cos lat0, cos d - sin lat0 sin lat)).
   - Step: one pixel (80 m) near the site, growing 2 % per step, out to 300 km
     (~300 steps). Switch to the 240 m DEM beyond the 80 m tile (|x|,|y| > 304 km)
     or beyond ~100 km (target tier).
   - Sample h at each point (bilinear), P = (R + h) * u(lat, lon), elevation
     e = asin(normalise(P - S) . Up).
   - mask[a] = max over samples.
3. The mask already includes curvature (no flat-Earth correction needed) and the
   horizon dip (for a perfectly flat sphere mask -> -sqrt(2 m / R): 0.087 deg for
   m = 2 m). **That is V2**: zero the DEM, expect -0.087 deg +/- 0.005 deg.

Vectorise over azimuths x steps with NumPy (720 x 300 = 216k samples per site:
milliseconds). Output per site and mast height: `{"site": id, "mast_m": 2,
"az_step_deg": 0.5, "mask_deg": [720 floats], "dem": "LDEM_80S_80MPP_ADJ",
"max_range_km": 300}` as JSON.

## Visibility

- **Sun as a disc** (0.53 deg): sample ~200 points on the disc (az, el offsets with
  az offset scaled by 1/cos(el)), interpolate the mask at each sample azimuth,
  fraction above = visible fraction. A centre-point lit/dark test is wrong whenever
  the Sun's centre is within 0.27 deg of the skyline, which at the pole is often.
- **Earth**: centre elevation > mask(az) + margin (default 0 deg). Earth disc ~1.9 deg.
- Interpolate the mask linearly in azimuth with wrap-around.

## Metrics (per site, from the hourly table, over the next 30 days from the chosen date)

- Sunlit hours (sum of visible fraction, or hours with fraction > 0.5: state which).
- Longest dark gap (longest run of hours with Sun fraction = 0), in hours/days.
- Earth contact hours (hours Earth centre above mask + margin).
- Time to next sunset / Earthset from the chosen instant (first transition); refine to
  minutes by linear interpolation between hourly samples if needed.
- The slip slider re-evaluates these for start date + slip; precompute nothing per
  slip: it is just a different window over the same hourly arrays.

## Browser version (custom coordinates, target tier)

Ship the 240 m DEM cropped to ~85-90 S (or 80 m downsampled) as a Float32/Int16
binary with an affine header; port the same marcher to JS (Float32Array, one
`for` loop over 720 x ~300). Must match the Python mask within V3's RMS for the 8
curated sites: test that in CI or a notebook before showing it.

## Uncertainty

V3: masks from 80 m vs 240 m DEM at the same site, RMS over azimuth = the stated
horizon uncertainty. 0.1 deg of horizon can move a sunset by hours or days (grazing
Sun). Show the mast height used next to every number.
