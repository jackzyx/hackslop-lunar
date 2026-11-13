---
name: shadow-map
description: Render a top-down lunar south pole shadow map in the browser (the "virtual table") by marching each heightmap pixel toward the Sun, matched to the printed relief, and de-rotate the overhead webcam view beside it. Use for the software shadow map, the webcam overlay, or the software-only fallback demo.
---

# Shadow map ("virtual table") and webcam view (Web)

Purpose: the right-hand panel the webcam view is compared against, and the full
fallback demo if the hardware dies (`context/08-risks.md`).

## Algorithm

- Input: the same 150 km heightmap as the print (Float32, metres, 300 x 300 is enough),
  its affine, and the Sun direction for the chosen instant (sub-solar lat/lon from the
  ephemeris table).
- For each pixel P: local Sun direction in that pixel's ENU (the Sun is effectively
  at infinity; the local elevation varies across the region because the surface
  curves, by up to 2.47 deg at 75 km: compute per pixel from the sub-solar vector and
  the pixel's up vector, do not use one global elevation).
- March from P toward the Sun's azimuth in map space, ~200 steps out to the tile edge
  (or 150-300 km), comparing terrain elevation angle (including curvature drop
  d^2 / 2R) against the Sun's elevation. Lit = no sample above. Soft edge: compute the
  margin and map +/- 0.27 deg (Sun radius) to a 0-1 ramp.
- 300 x 300 x 200 = 18 M samples per frame: fine in JS for a slider. If slow: WebGL
  fragment shader, or a 150 x 150 preview while dragging.
- Colour: lit = light grey, shadow = near-black, PSR outline overlaid; site pins with
  their status.

## Webcam canvas

- `navigator.mediaDevices.getUserMedia({video: {width: 1280, height: 720}})` into a
  `<video>`, draw into a `<canvas>` every frame with
  `ctx.translate(cx, cy); ctx.rotate(-tableAngleRad); ctx.drawImage(...)` so lunar
  north stays up while the table turns. Calibrate centre (cx, cy) and zero angle once
  with a click on the pole and one on the 0 deg mark.
- Show webcam left, shadow map right, same scale and orientation (video shot 8-14 s).
- Needs a secure context (https or localhost) and camera permission. Test the
  projector layout Sat night.
