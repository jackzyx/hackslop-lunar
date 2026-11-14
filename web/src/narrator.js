// STARS narrator: one plain sentence about the two chosen sites, built only from numbers the app
// computed (no language model, so it runs offline and never invents a number).
// Each site: { name, now, onTime, d }: sunlit hours in the 30 days after the current landing and
// after the planned one, and verdictDelay's d (first slip in days that drops it under half; null = none).
import { WINDOW_H, GOOD, MAX_DELAY_D } from "./metrics.js";

const HALF = GOOD * WINDOW_H;
const HOLD_H = 12; // a change smaller than this reads as "holds" (under 2 % of the window)
const h = (x) => `${Math.round(x)} h`;
const both = (ss) => ss.map((s) => s.name).join(" and ");

export function narrate(delay, sites) {
  if (delay === 0) {
    const [a, b] = sites;
    const lead = `On time: ${a.name} gets ${h(a.now)} of sunlight, ${b.name} ${h(b.now)}.`;
    const atRisk = sites.filter((s) => s.d > 0).sort((x, y) => x.d - y.d)[0];
    const under = sites.filter((s) => s.d === 0);
    const tail = atRisk ? `A ${atRisk.d}-day slip drops ${atRisk.name} below half.`
      : under.length ? `${both(under)} ${under.length > 1 ? "are" : "is"} under half even on time.`
      : `Both stay above half through a ${MAX_DELAY_D}-day slip.`;
    return `${lead} ${tail}`;
  }
  const n = Math.abs(delay), days = `${n} day${n === 1 ? "" : "s"}`;
  const clause = (s) => {
    if (s.onTime >= HALF && s.now < HALF) return `${s.name} drops below half, ${h(s.onTime)} to ${h(s.now)}`;
    if (s.onTime < HALF && s.now >= HALF) return `${s.name} climbs above half, ${h(s.onTime)} to ${h(s.now)}`;
    const diff = Math.round(s.now - s.onTime);
    if (Math.abs(diff) < HOLD_H) return `${s.name} holds at ${h(s.now)}`;
    return `${s.name} ${diff < 0 ? "loses" : "gains"} ${Math.abs(diff)} h, now ${h(s.now)}`;
  };
  return `${delay > 0 ? `Slip ${days}` : `Launch ${days} early`}: ${sites.map(clause).join("; ")}.`;
}
