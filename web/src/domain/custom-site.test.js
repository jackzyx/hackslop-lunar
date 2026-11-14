import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { terrainFrom, TERRAIN } from "../terrain/shadow.js";
import { horizonMask, buildCustomSite, fromMap, poleKm, MAX_POLE_KM } from "./custom-site.js";
import { visibility, windowMetrics, WINDOW_H } from "./metrics.js";
import { dailyWindows, bestDays } from "./best-days.js";
import { toMap } from "../terrain/shadow.js";

const data = JSON.parse(readFileSync(new URL("../data/ephemeris.json", import.meta.url)));
const terrain = terrainFrom(readFileSync(new URL("../../public/terrain_500m.bin", import.meta.url)).buffer.slice(0));
const shipped = data.sites.filter((s) => s.terrain_modelled !== false).map((s) => ({ ...s, table: data.ephemeris.sites[s.id] }));

test("flat terrain: skyline is the horizon dip of a 2 m mast (V2 analogue)", () => {
  const flat = { ...TERRAIN, h: new Int16Array(TERRAIN.n ** 2), hmax: 0 };
  const { mask } = horizonMask(flat, -88, 45);
  const dip = -Math.sqrt((2 * 0.002) / 1737.4) * 180 / Math.PI; // -0.0869 deg
  for (const v of mask) assert.ok(Math.abs(v - dip) < 0.005, `${v} vs ${dip}`);
});

test("map <-> lat/lon round trip", () => {
  const { lat, lon } = fromMap(...toMap(-87.45, 355));
  assert.ok(Math.abs(lat + 87.45) < 1e-9 && Math.abs(lon - 355) < 1e-9);
});

test("rebuilt Sun and Earth angles match SPICE at every shipped site within 0.001 deg", () => {
  for (const s of shipped) {
    const { table } = buildCustomSite(terrain, shipped.filter((x) => x.id !== s.id), { id: "X", name: "x", lat: s.lat, lon: s.lon });
    const ref = data.ephemeris.sites[s.id];
    for (let i = 0; i < ref.sun_az.length; i += 97) {
      const dAz = (a, b, el) => Math.abs(((a - b + 540) % 360) - 180) * Math.cos(el * Math.PI / 180);
      assert.ok(Math.abs(table.sun_el[i] - ref.sun_el[i]) < 1e-3 && dAz(table.sun_az[i], ref.sun_az[i], ref.sun_el[i]) < 1e-3, `${s.id} sun ${i}`);
      assert.ok(Math.abs(table.earth_el[i] - ref.earth_el[i]) < 1e-3 && dAz(table.earth_az[i], ref.earth_az[i], ref.earth_el[i]) < 1e-3, `${s.id} earth ${i}`);
    }
  }
});

test("custom sites only inside the validated area", () => {
  assert.throws(() => buildCustomSite(terrain, shipped, { id: "X", name: "x", lat: -80, lon: 0 }), /within 160 km/);
  assert.ok(poleKm(-84.79, 29.2) <= MAX_POLE_KM); // Mons Mouton, the farthest shipped site
});

test("best days: windows match windowMetrics; picks are spread out and sorted", () => {
  const v = visibility(shipped[0].horizon, shipped[0].table);
  const rows = dailyWindows(v, 24 * 400, 365);
  const m = windowMetrics(v, rows[10].i);
  assert.ok(Math.abs(rows[10].sunlit - m.sunlit) < 1e-6 && rows[10].earth === m.earth);
  for (const goal of ["sunlit", "earth", "both"]) {
    const best = bestDays(rows, goal);
    assert.equal(best.length, 3);
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) assert.ok(Math.abs(best[a].d - best[b].d) >= 7);
  }
  assert.ok(bestDays(rows, "sunlit")[0].sunlit >= Math.max(...rows.map((r) => r.sunlit)) - 1e-9);
  assert.equal(dailyWindows(v, v.sun.length - WINDOW_H - 24, 5).length, 2); // windows past the table are dropped
});
