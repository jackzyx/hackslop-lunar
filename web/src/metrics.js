// Site metrics from a horizon mask and an hourly ephemeris. Pure functions, used by
// the app and by scripts/make-mock-data.mjs. Angles in degrees, azimuth clockwise from north.

export const SUN_RADIUS_DEG = 0.2665; // mean apparent solar radius seen from the Moon
export const WINDOW_H = 720; // 30 days, hourly
export const GOOD = 0.5; // share of the window with sunlight: >= GOOD is "good"
export const POOR = 0.25; // below POOR is "poor"
export const MAX_DELAY_D = 60;

// Skyline elevation at any azimuth: mask has 720 values at 0.5 deg steps, linear, wraps.
export function maskAt(mask, az) {
  const x = (((az % 360) + 360) % 360) * 2;
  const i = Math.floor(x), f = x - i;
  return mask[i % 720] * (1 - f) + mask[(i + 1) % 720] * f;
}

// Visible fraction of the solar disc whose centre is at el, over a skyline at horizon.
// shortcut: treats the skyline as straight across the 0.53 deg disc; sample the disc
// against the mask (horizon-mask skill) if V4 shows it matters.
export function sunFraction(el, horizon) {
  const h = (el - horizon) / SUN_RADIUS_DEG;
  if (h >= 1) return 1;
  if (h <= -1) return 0;
  return 1 - (Math.acos(h) - h * Math.sqrt(1 - h * h)) / Math.PI;
}

// Per-hour Sun visible fraction and Earth in view (centre above skyline) for a whole table.
export function visibility(horizon, eph) {
  const n = eph.sun_el.length, sun = new Float32Array(n), earth = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    sun[i] = sunFraction(eph.sun_el[i], maskAt(horizon, eph.sun_az[i]));
    earth[i] = eph.earth_el[i] > maskAt(horizon, eph.earth_az[i]) ? 1 : 0;
  }
  return { sun, earth };
}

// Hours until arr first goes to 0 after i0; null if it is already 0 at i0, Infinity if never in n.
function setIn(arr, i0, n) {
  if (!arr[i0]) return null;
  for (let i = i0 + 1; i < i0 + n; i++) if (!arr[i]) return i - i0;
  return Infinity;
}

// The four numbers for the n hours starting at index i0. Sunlit hours = sum of disc fraction;
// dark = no part of the disc visible.
export function windowMetrics(vis, i0, n = WINDOW_H) {
  let sunlit = 0, earth = 0, darkGap = 0, run = 0;
  for (let i = i0; i < i0 + n; i++) {
    sunlit += vis.sun[i];
    earth += vis.earth[i];
    run = vis.sun[i] === 0 ? run + 1 : 0;
    if (run > darkGap) darkGap = run;
  }
  return { sunlit, earth, darkGap, sunsetIn: setIn(vis.sun, i0, n), earthsetIn: setIn(vis.earth, i0, n) };
}

export function grade(sunlitH, n = WINDOW_H) {
  return sunlitH >= GOOD * n ? "good" : sunlitH >= POOR * n ? "warning" : "critical";
}

// First delay in days (0..MAX_DELAY_D) whose 30-day window gets under GOOD sunlight; null if none.
export function verdictDelay(vis, iPlanned) {
  for (let d = 0; d <= MAX_DELAY_D; d++) {
    if (windowMetrics(vis, iPlanned + d * 24).sunlit < GOOD * WINDOW_H) return d;
  }
  return null;
}

// Model table drivers: table angle = sub-solar longitude, lamp height = L k tan(-sub-solar lat).
// The turning direction of the table is fixed on the rig on Saturday (twin-rig skill).
export function rig(subLonDeg, subLatDeg, lampDistMm = 3000, k = 3) {
  return {
    tableDeg: ((subLonDeg % 360) + 360) % 360,
    lampMm: lampDistMm * k * Math.tan((-subLatDeg * Math.PI) / 180),
  };
}
