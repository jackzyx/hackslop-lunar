// The precomputed table (Science writes it: science/lunar_ephemeris.py) and small formatters.
import data from "@/mock-data.json"; // real SPICE data since 2887e67; the name is kept for the pipeline
import { visibility } from "@/metrics.js";
import { sunVector } from "@/shadow.js";

export { data };
export const H = 3600e3, DAY = 86400e3;
export const t0 = Date.parse(data.ephemeris.start_utc);
export const sites = Object.fromEntries(data.sites.map((s) => [s.id, s]));
const visCache = {};
export const vis = (id) => (visCache[id] ??= visibility(sites[id].horizon, data.ephemeris.sites[id]));
// Sun unit vector (MOON_ME) at hour i, from one site's row; the same over the whole region.
export const sunAt = (id, i) => { const e = data.ephemeris.sites[id]; return sunVector(sites[id].lat, sites[id].lon, e.sun_az[i], e.sun_el[i]); };

export const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
export const fmtDate = (ms, o) => new Date(ms).toLocaleDateString("en-IE", { timeZone: "UTC", day: "numeric", month: "short", ...o });
export const fmtTime = (ms) => new Date(ms).toLocaleString("en-IE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const dur = (h) => {
  if (h < 48) return `${Math.round(h)} h`;

  const days = Math.floor(h / 24);
  const hours = Math.round(h % 24);
  return hours === 0 ? `${days} d` : `${days} d ${hours} h`;
};
export const latLon = (s) => `${Math.abs(s.lat).toFixed(2)}°${s.lat < 0 ? "S" : "N"} ${s.lon.toFixed(1)}°E`;
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
