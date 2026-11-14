// Best landing days: each day at the selected UTC hour, scored on its following 30-day window.
// "Earth" is geometric line of sight (Earth's centre above the skyline), not a radio link.
import { WINDOW_H } from "./metrics.js";

export const GOALS = {
  sunlit: { label: "Most sunlight", score: (r) => r.sunlit },
  earth: { label: "Most Earth contact", score: (r) => r.earth },
  both: { label: "Best of both", score: (r) => Math.min(r.sunlit, r.earth) }, // the weaker of the two
};

const prefix = new WeakMap(); // visibility object -> cumulative sums
function sums(vis) {
  let p = prefix.get(vis);
  if (!p) {
    const n = vis.sun.length, sun = new Float64Array(n + 1), earth = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) { sun[i + 1] = sun[i] + vis.sun[i]; earth[i + 1] = earth[i] + vis.earth[i]; }
    prefix.set(vis, (p = { sun, earth }));
  }
  return p;
}

// One row per landing day d = 0..days-1 starting at hour iFrom + 24 d; days whose window leaves the table are dropped.
export function dailyWindows(vis, iFrom, days) {
  return landingWindows(vis, iFrom, days, 24);
}

// Search every hour, including all 24 hours of the last candidate date.
export function hourlyWindows(vis, iFrom, days) {
  return landingWindows(vis, iFrom, days, 1);
}

function landingWindows(vis, iFrom, days, stride) {
  const { sun, earth } = sums(vis), n = vis.sun.length, rows = [];
  for (let hour = 0; hour < days * 24; hour += stride) {
    const i = iFrom + hour;
    if (i < 0 || i + WINDOW_H > n) continue;
    rows.push({ d: hour / 24, i, sunlit: sun[i + WINDOW_H] - sun[i], earth: earth[i + WINDOW_H] - earth[i] });
  }
  return rows;
}

// Top k days for a goal, at least `gap` days apart so they are distinct options; earlier day wins ties.
export function bestDays(rows, goal, k = 3, gap = 7) {
  const score = GOALS[goal].score, picked = [];
  for (const r of [...rows].sort((a, b) => score(b) - score(a) || a.d - b.d)) {
    if (picked.every((p) => Math.abs(p.d - r.d) >= gap)) picked.push(r);
    if (picked.length === k) break;
  }
  return picked;
}
