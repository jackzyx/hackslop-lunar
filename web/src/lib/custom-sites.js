// Custom sites live alongside the shipped ones in `data`, so every card, chart and map pin works
// unchanged. The list (name, lat, lon) is kept in this browser only and rebuilt on load.
import { data, sites, forgetVis } from "@/lib/data.js";
import { buildCustomSite } from "@/domain/custom-site.js";

const KEY = "sun-shade-custom-sites";
const MAX = 6;
export const MAX_CUSTOM = MAX;
const shipped = () => data.sites.filter((s) => !s.custom && s.terrain_modelled !== false).map((s) => ({ ...s, table: data.ephemeris.sites[s.id] }));
const fmt = (lat, lon) => `${Math.abs(lat).toFixed(2)}°S ${lon.toFixed(1)}°E`;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(customSites().map(({ name, lat, lon }) => ({ name, lat, lon })))); } catch {} };

export const customSites = () => data.sites.filter((s) => s.custom);

// Adds a site at lat/lon; returns its id. Throws (with a readable message) outside the valid area.
export function addCustomSite(terrain, lat, lon, name, persist = true) {
  if (customSites().length >= MAX) throw new Error(`Up to ${MAX} custom sites; remove one first`);
  const n = Math.max(0, ...customSites().map((s) => +s.id.slice(1))) + 1, id = `X${n}`;
  const { site, table } = buildCustomSite(terrain, shipped(), { id, name: name ?? `Custom ${n} · ${fmt(lat, lon)}`, lat, lon });
  data.sites.push(site);
  data.ephemeris.sites[id] = table;
  sites[id] = site;
  if (persist) save();
  return id;
}

export function removeCustomSite(id) {
  const k = data.sites.findIndex((s) => s.id === id && s.custom);
  if (k < 0) return;
  data.sites.splice(k, 1);
  delete data.ephemeris.sites[id];
  delete sites[id];
  forgetVis(id);
  save();
}

// Rebuild saved sites once terrain is available; bad entries are skipped.
export function restoreCustomSites(terrain) {
  if (customSites().length) return;
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch {}
  for (const s of Array.isArray(saved) ? saved.slice(0, MAX) : []) {
    try { if (Number.isFinite(s.lat) && Number.isFinite(s.lon)) addCustomSite(terrain, s.lat, s.lon, typeof s.name === "string" ? s.name.slice(0, 60) : undefined, false); } catch {}
  }
}
