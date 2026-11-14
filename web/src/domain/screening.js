// STARS mission screening: the eight south-pole sites against the user's criteria, using only
// windowMetrics over the precomputed visibility (metrics.js). Pure functions; no UI, no model.
// A screening result is a statement about sunlight and geometric Earth line of sight in a 30-day
// window. It is not a power budget, a communications link, or a landing-safety assessment.
import { windowMetrics, WINDOW_H, GOOD, MAX_DELAY_D } from "./metrics.js";

export const SCREEN_SITES = ["A", "B", "C", "D", "E", "F", "G", "H"]; // the eight curated south-pole sites
// Excluded from rankings until reviewed: V4 shows 23.0 % mean illumination in our model vs 4.6 % in
// NASA PGDA 69 (validation.json). Its numbers are still shown, with this flag.
export const UNDER_REVIEW = { G: "V4 cross-check disagrees with NASA PGDA 69 (23.0 % model vs 4.6 % NASA); excluded from rankings pending review." };
export const TIE_H = 12; // differences under 12 h (1.7 % of 720 h) are reported as ties, as the narrator does
export const SEARCH_D = MAX_DELAY_D; // landing-date search, days either side, one start per day at 00:00 UTC

export const DEFAULT_PREFS = Object.freeze({
  minSunlitH: GOOD * WINDOW_H, // the app's existing "good" line: half the window
  maxDarkGapH: null, // null = no constraint
  minEarthH: null,
  objective: "sunlit", // what ranks passing sites: sunlit | earth | darkgap
});
export const OBJECTIVES = { sunlit: "sunlight hours", earth: "Earth line-of-sight hours", darkgap: "shortest longest dark gap" };
export const LIMITS = { minSunlitH: [0, WINDOW_H], maxDarkGapH: [0, WINDOW_H], minEarthH: [0, WINDOW_H] };

// Validated prefs: unknown keys dropped, out-of-range or non-integer values rejected (never clamped silently).
export function checkPrefs(p) {
  const out = { ...DEFAULT_PREFS }, errors = [];
  for (const [k, v] of Object.entries(p ?? {})) {
    if (k === "objective") { if (v in OBJECTIVES) out.objective = v; else errors.push(`objective "${v}" is not supported`); continue; }
    if (!(k in LIMITS)) continue;
    if (v === null) { out[k] = k === "minSunlitH" ? 0 : null; continue; }
    const [lo, hi] = LIMITS[k];
    if (Number.isInteger(v) && v >= lo && v <= hi) out[k] = v; else errors.push(`${k} must be a whole number of hours from ${lo} to ${hi}`);
  }
  return { prefs: out, errors };
}

// Score used for ranking (bigger is better) and the measurement it came from.
const score = (m, objective) => objective === "earth" ? m.earth : objective === "darkgap" ? -m.darkGap : m.sunlit;

// Which criteria fail for one window's metrics, with the measured value and the limit.
export function failures(m, prefs) {
  const f = [];
  if (m.sunlit < prefs.minSunlitH) f.push({ key: "sunlit", label: "sunlight", value: m.sunlit, limit: prefs.minSunlitH, op: "≥" });
  if (prefs.maxDarkGapH !== null && m.darkGap > prefs.maxDarkGapH) f.push({ key: "darkGap", label: "longest dark gap", value: m.darkGap, limit: prefs.maxDarkGapH, op: "≤" });
  if (prefs.minEarthH !== null && m.earth < prefs.minEarthH) f.push({ key: "earth", label: "Earth line of sight", value: m.earth, limit: prefs.minEarthH, op: "≥" });
  return f;
}

// A window is assessable only if all 720 hours lie inside the ephemeris table.
export const covered = (i0, count, n = WINDOW_H) => Number.isInteger(i0) && i0 >= 0 && i0 + n <= count;

// Evaluate one site at one start hour. null metrics = incomplete coverage.
export function evaluate(id, vis, i0, count, prefs) {
  if (!covered(i0, count)) return { id, i0, complete: false, m: null, fails: [], pass: false };
  const m = windowMetrics(vis(id), i0), fails = failures(m, prefs);
  return { id, i0, complete: true, m, fails, pass: fails.length === 0 };
}

const cache = new Map(); // key -> metrics; the visibility tables never change at runtime
function metricsAt(id, vis, i0) {
  const key = `${id}@${i0}`;
  let m = cache.get(key);
  if (!m) { m = windowMetrics(vis(id), i0); cache.set(key, m); }
  return m;
}

// Daily landing starts from -SEARCH_D..+SEARCH_D around iPlanned: which pass, and the nearest one.
export function searchDates(id, vis, iPlanned, count, prefs, days = SEARCH_D) {
  const passing = [], missing = [];
  let nearest = null;
  for (let d = -days; d <= days; d++) {
    const i0 = iPlanned + d * 24;
    if (!covered(i0, count)) { missing.push(d); continue; }
    const m = metricsAt(id, vis, i0);
    if (failures(m, prefs).length) continue;
    passing.push(d);
    // nearest to plan; on equal distance prefer the later date (a slip is the usual case)
    if (!nearest || Math.abs(d) < Math.abs(nearest.d) || (Math.abs(d) === Math.abs(nearest.d) && d > nearest.d)) nearest = { d, m };
  }
  return { passing, missing, nearest };
}

// Screen the eight sites for a landing at hour index i0 (planned date plus any slip).
// Returns per-site rows, the ranked eligible passers, a winner or a tie, and, when nothing passes,
// the nearest passing landing day within ±SEARCH_D of the planned date (shift.d = the slip in days).
export function screen({ vis, i0, iPlanned = i0, count, prefs: rawPrefs, names = {} }) {
  const { prefs, errors } = checkPrefs(rawPrefs);
  const rows = SCREEN_SITES.map((id) => ({ ...evaluate(id, vis, i0, count, prefs), name: names[id] ?? id, review: UNDER_REVIEW[id] ?? null }));
  const incomplete = rows.filter((r) => !r.complete).map((r) => r.id);
  if (incomplete.length) return { prefs, errors, rows, incomplete, ranked: [], status: "incomplete" };

  const ranked = rows.filter((r) => r.pass && !r.review).sort((a, b) => score(b.m, prefs.objective) - score(a.m, prefs.objective));
  let status = "none", tie = [];
  if (ranked.length === 1) status = "winner";
  else if (ranked.length > 1) {
    const top = score(ranked[0].m, prefs.objective);
    tie = ranked.filter((r) => top - score(r.m, prefs.objective) < TIE_H);
    status = tie.length > 1 ? "tie" : "winner";
  }
  // Nothing passes on this date: nearest day (within ±SEARCH_D of the plan) at which any eligible site passes.
  let shift = null;
  if (status === "none") {
    for (const r of rows.filter((r) => !r.review)) {
      const { nearest } = searchDates(r.id, vis, iPlanned, count, prefs);
      if (nearest && (!shift || Math.abs(nearest.d) < Math.abs(shift.d) || (Math.abs(nearest.d) === Math.abs(shift.d) && score(nearest.m, prefs.objective) > score(shift.m, prefs.objective))))
        shift = { id: r.id, name: r.name, ...nearest };
    }
  }
  return { prefs, errors, rows, incomplete, ranked, status, tie: tie.map((r) => r.id), shift };
}
