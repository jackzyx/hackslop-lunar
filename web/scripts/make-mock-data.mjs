// Writes web/src/mock-data.json: FAKE sites, horizon masks and ephemeris for the
// UI mockup, in the shape the real Science outputs will have (see web/README.md).
// Geometry is real (site ENU frame, az clockwise from north), the inputs are invented:
// sub-solar and sub-Earth points are sine waves, masks are random skylines.
// Run: npm run mock   (from web/). Fails if the fake data stops telling the story.
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { visibility, windowMetrics, verdictDelay, grade } from "../src/domain/metrics.js";

const R = 1737.4; // km
const START = Date.parse("2026-09-01T00:00:00Z");
const COUNT = 212 * 24; // hourly to 2027-04-01
const DAY = 86400e3, rad = Math.PI / 180;

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; // Park-Miller

// [id, kind, lat, lon, skyline base deg, roughness deg, ridges [height, az, width]]
const SITES = [
  ["A", "slope under a ridge", -89.45, 205, 0.76, 0.25, [[1.2, 140, 25], [0.8, 300, 30]]],
  ["B", "ridge crest", -89.2, 228,-0.2, 0.15, [[0.3, 20, 15]]],
  ["C", "crater rim", -88.6, 130, 0.7, 0.5, [[1.5, 250, 20]]],
  ["D", "massif flank", -87.6, 330, 1.4, 0.8, [[3.0, 160, 35]]],
  ["E", "smooth plain", -86.9, 20, 0.5, 0.4, []],
  ["F", "crater floor", -85.6, 60, 3.2, 0.8, [[2.0, 240, 40]]],
  ["G", "rim crest", -89.75, 300, 0.15, 0.25, [[0.6, 90, 20]]],
  ["H", "highland", -84.8, 350, 0.9, 0.6, [[1.0, 120, 30]]],
];

function skyline(base, rough, ridges) {
  const harm = [1, 2, 3, 5, 8].map((k) => [k, (rough * rnd()) / Math.sqrt(k), 2 * Math.PI * rnd()]);
  return Array.from({ length: 720 }, (_, i) => {
    const a = i / 2;
    let h = base;
    for (const [k, amp, ph] of harm) h += amp * Math.cos(k * a * rad + ph);
    for (const [hgt, c, w] of ridges) {
      const d = ((a - c + 540) % 360) - 180;
      h += hgt * Math.exp(-(d * d) / (2 * w * w));
    }
    return +h.toFixed(3);
  });
}

const unit = (lat, lon) => [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function azel(d, up, east, north) {
  return [((Math.atan2(dot(d, east), dot(d, north)) / rad) + 360) % 360, Math.asin(dot(d, up)) / rad];
}

// Invented ephemeris: lunar day 29.53 d, Sun latitude cycle 346.6 d, Earth libration ~27.2/27.6 d.
const days = (i) => (START + i * 3600e3 - Date.parse("2026-11-14T12:00:00Z")) / DAY;
const subSun = (i) => [-1.588 * Math.cos((2 * Math.PI * (days(i) + 11.5)) / 346.62), (((120.5 - (360 / 29.530589) * days(i)) % 360) + 360) % 360];
const subEarth = (i) => [6.69 * Math.sin((2 * Math.PI * (days(i) - 3)) / 27.2122), 7.9 * Math.sin((2 * Math.PI * (days(i) + 6)) / 27.5545)];
const earthDist = (i) => 385000 - 21000 * Math.cos((2 * Math.PI * (days(i) + 6)) / 27.5545);

const r2 = (x) => +x.toFixed(3);
const sites = [], eph = {};
for (const [id, kind, lat, lon, base, rough, ridges] of SITES) {
  sites.push({ id, name: `Site ${id}`, kind, mission: null, lat, lon, mast_m: 2, az_step_deg: 0.5, horizon: skyline(base, rough, ridges) });
  const up = unit(lat, lon), east = norm(cross([0, 0, 1], up)), north = cross(up, east);
  const site = up.map((x) => x * R);
  const e = { sun_az: [], sun_el: [], earth_az: [], earth_el: [] };
  for (let i = 0; i < COUNT; i++) {
    const [sa, se] = azel(unit(...subSun(i)), up, east, north); // Sun parallax is negligible
    const ev = unit(...subEarth(i)).map((x, j) => x * earthDist(i) - site[j]);
    const [ea, ee] = azel(norm(ev), up, east, north);
    e.sun_az.push(r2(sa)); e.sun_el.push(r2(se)); e.earth_az.push(r2(ea)); e.earth_el.push(r2(ee));
  }
  eph[id] = e;
}

const head = { start_utc: new Date(START).toISOString(), step_s: 3600, count: COUNT };
const out = {
  mock: true,
  note: "FAKE data for the UI mockup. Not computed from SPICE or LOLA. Never quote these numbers.",
  sites,
  ephemeris: { ...head, frame: "MOON_ME", az: "deg clockwise from north", el: "deg", sites: eph },
};
writeFileSync(new URL("../src/mock-data.json", import.meta.url), JSON.stringify(out));

// The story the mockup must tell, at the default planned date: A loses the Sun as the delay grows, B holds.
const iPlanned = (Date.parse("2026-11-20T00:00:00Z") - START) / 3600e3;
const vis = Object.fromEntries(sites.map((s) => [s.id, visibility(s.horizon, eph[s.id])]));
for (const s of sites) {
  const row = [-60, 0, 30, 60].map((d) => windowMetrics(vis[s.id], iPlanned + d * 24).sunlit.toFixed(0).padStart(4));
  console.log(s.id, s.kind.padEnd(20), "sunlit h at delay -60/0/30/60:", row.join(" "), " verdict day:", verdictDelay(vis[s.id], iPlanned));
}
const dA = verdictDelay(vis.A, iPlanned);
assert.equal(grade(windowMetrics(vis.A, iPlanned).sunlit), "good", "A should start well lit");
assert.ok(dA >= 8 && dA <= 25, `A should fall below half sunlight after 8-25 days, got ${dA}`);
assert.equal(verdictDelay(vis.B, iPlanned), null, "B should hold through 60 days");
console.log("story OK, wrote src/mock-data.json");
