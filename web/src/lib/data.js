import ephemerisUrl from "@/data/ephemeris.json?url&no-inline";
import { visibility } from "@/domain/metrics.js";
import { sunVector } from "@/terrain/shadow.js";

export let data, t0, sites;
export const H = 3600e3, DAY = 86400e3;

let dataReady;

async function readEphemeris(response) {
  if (!response.ok) throw new Error(`Ephemeris request failed (HTTP ${response.status})`);
  const dataset = await response.json();
  const ephemeris = dataset?.ephemeris;
  if (!Array.isArray(dataset?.sites) || !ephemeris?.sites || !Number.isFinite(Date.parse(ephemeris.start_utc)) ||
      !Number.isSafeInteger(ephemeris.count) || ephemeris.count < 1 ||
      !['A', 'B'].every(id => dataset.sites.some(site => site?.id === id)) ||
      !dataset.sites.every(site => {
        const angles = ephemeris.sites[site?.id];
        return site?.horizon?.length === 720 && ['sun_az', 'sun_el', 'earth_az', 'earth_el'].every(
          key => Array.isArray(angles?.[key]) && angles[key].length === ephemeris.count
        );
      })) {
    throw new Error('Invalid ephemeris data');
  }
  return dataset;
}

async function fetchEphemeris() {
  const url = new URL(ephemerisUrl, import.meta.url);
  const cache = import.meta.env.PROD
    ? await globalThis.caches?.open(`sun-shade-ephemeris:${new URL('.', url).href}`).catch(() => null)
    : null;

  try {
    const cachedResponse = await cache?.match(url.href);
    if (cachedResponse) return await readEphemeris(cachedResponse);
  } catch {}

  const previous = cache?.keys().catch(() => []);
  const response = await fetch(url, { cache: import.meta.env.DEV ? 'no-store' : 'default' });
  const cacheResponse = cache && response.ok ? response.clone() : null;
  const dataset = await readEphemeris(response);

  if (cacheResponse) {
    previous.then(async requests => {
      await cache.put(url.href, cacheResponse);
      await Promise.all(requests.filter(request => request.url !== url.href).map(request => cache.delete(request)));
    }).catch(() => {});
  }

  return dataset;
}

export function loadPlannerData() {
  return dataReady ??= fetchEphemeris().then(dataset => {
    data = dataset;
    t0 = Date.parse(dataset.ephemeris.start_utc);
    sites = Object.fromEntries(dataset.sites.map(site => [site.id, site]));
  }).catch(error => {
    dataReady = undefined;
    throw error;
  });
}

const visCache = {};
export const vis = (id) => (visCache[id] ??= visibility(sites[id].horizon, data.ephemeris.sites[id]));
export const forgetVis = (id) => { delete visCache[id]; };
// Sun unit vector (MOON_ME) at hour i, from one site's row; the same over the whole region.
export const sunAt = (id, i) => { const e = data.ephemeris.sites[id]; return sunVector(sites[id].lat, sites[id].lon, e.sun_az[i], e.sun_el[i]); };

export const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const dateFormats = new Map();
export const fmtDate = (ms, options) => {
  const key = JSON.stringify(options ?? {});
  if (!dateFormats.has(key)) dateFormats.set(key, new Intl.DateTimeFormat('en-IE', { timeZone: 'UTC', day: 'numeric', month: 'short', ...options }));
  return dateFormats.get(key).format(new Date(ms));
};
export const fmtTime = (ms) => new Date(ms).toLocaleString("en-IE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const dur = (h) => {
  if (h < 48) return `${Math.round(h)} h`;

  const days = Math.floor(h / 24);
  const hours = Math.round(h % 24);
  return hours === 0 ? `${days} d` : `${days} d ${hours} h`;
};
export const latLon = (s) => `${Math.abs(s.lat).toFixed(2)}°${s.lat < 0 ? "S" : "N"} ${s.lon.toFixed(1)}°E`;
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
