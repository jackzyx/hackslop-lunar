// Science writes src/validation.json; null = not measured yet. Nobody types these numbers by hand.
import validation from "@/validation.json";

export { validation };
// Two significant figures however small (Horizons agreement is ~0.00003 deg; 4 decimals would print 0).
export const fmtDeg = (x) => (x == null ? "–" : x === 0 ? "0°" : `${x.toFixed(Math.max(4, 1 - Math.floor(Math.log10(x))))}°`);
export const done = validation.rows.filter((r) => r.max_del_deg != null && r.max_daz_cos_deg != null);
export const worst = done.length ? Math.max(...done.flatMap((r) => [r.max_del_deg, r.max_daz_cos_deg])) : null;
