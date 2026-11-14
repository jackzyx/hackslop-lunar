---
name: relief-print
description: DROPPED Sat 14 Nov (software only, reference only). Turn a LOLA heightmap into a watertight, printable STL of the lunar south pole on its spherical cap (1 mm = 1 km, vertical exaggeration k = 3, 150 mm disc, 3 mm base) with trimesh/numpy, plus slicer settings, test coupon and finishing. Use for anything about the 3D-printed relief, mesh generation, STL, slicing or print failures.
---

# Relief print (Hardware)

> **Dropped Sat 14 Nov 10:15: software only.** Reference only, do not build.

Context: `context/06-hardware.md`. Heightmap comes from Science (skill `lola-dem`) as a
16-bit PNG + JSON sidecar by **Fri 20:45**. Gate: **full print running Fri 23:30**.

## Geometry (must carry curvature)

    x = s (R + h) sin c sin(lambda)
    y = s (R + h) sin c cos(lambda)
    z = s k [ (R + h) cos c - R ]

s = 1/1,000,000 (model length / real length). Easiest bookkeeping: put R and h in
**kilometres** and drop s; the result is then in **millimetres** (1 km real = 1 mm model).
R = 1737.4, h = DEM height / 1000, k = 3,
c = angular distance from the pole, lambda = east longitude. The same (x, y) layout
as the polar stereographic map (lon 0 at +y, east clockwise from above). A site 75 km
out sits 2.47 deg "downhill" from the pole: the cap is what gives every site its real
daily swing in Sun elevation. Vertical exaggeration applies to the cap drop too
(the formula's z already includes it).

Practical route: for each heightmap pixel (x_ps, y_ps) in projected metres, get
(lat, lon) with pyproj, compute c = 90 deg + lat (south), then the formula above.
Build a grid mesh (two triangles per quad), clip to a 150 mm disc, add a skirt down to
a flat base 3 mm below the lowest point, close the bottom. `trimesh.Trimesh(v, f)`;
check `mesh.is_watertight`, `mesh.fix_normals()`, export `relief_150mm_k3.stl`.
Grid: 0.2-0.25 mm spacing is plenty (nozzle 0.4 mm resolves ~400 m features);
600-750 px across keeps the STL < 50 MB.

Add: a registration notch or flat at lunar 0 deg longitude on the rim (for table zero),
and a 1 mm pin hole at each of the 8 sites if pins are glued in later.

## Practise first (any time, allowed pre-event)

Run the pipeline on unrelated terrain (an Irish DEM or a Mars crater) to learn trimesh
and the slicer. Do not prepare the real region's mesh before the event without the
organisers' written yes.

## Slicing

- Layer height **0.16 mm or finer** (0.2 mm layers cast 2.5 mm stripes at grazing light).
- 2-3 walls, 10-15 % infill, no supports (terrain faces up), brim if warping.
- PLA white or light grey, matte. Nozzle 0.4 mm.
- **Coupon first**: a 60 mm crop at the same settings (~30 min). Inspect under a torch
  at 5 deg elevation before committing the full print.
- Full print 2-4 h (fast printer) to 6-9 h (older). Print two copies on two printers
  (A by 23:00, B by 23:30). Ask the makerspace about overnight rules.

## Fallbacks (in order)

Two halves on two printers -> 120 mm disc -> CNC foam if it exists -> paper hillshade
print on the table with software only.

## Finishing (Sat morning)

Light sand 400 grit, matte grey primer outdoors (45 min dry). Pins at the 8 sites.
