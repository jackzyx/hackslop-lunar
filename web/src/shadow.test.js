import { test } from "node:test";
import assert from "node:assert/strict";
import { sunVector, toMap, localSun, mapViewport, shadeView, TERRAIN } from "./shadow.js";

const near = (a, b, tol) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);
const flat = (fill = 0) => ({ ...TERRAIN, h: new Int16Array(TERRAIN.n ** 2).fill(fill), hmax: fill / 1000 });

test("sun az/el at a site comes back out of localSun, and map directions match azimuths", () => {
  for (const [lat, lon] of [[-89.5, 0], [-87, 120], [-85, 250]]) {
    for (const [az, el] of [[0, 1.5], [90, -0.7], [217, 2.2]]) {
      const s = localSun(sunVector(lat, lon, az, el), ...toMap(lat, lon));
      near(Math.asin(s.sinEl) / (Math.PI / 180), el, 1e-9);
    }
  }
  // At lon 0 (straight up the map), north is +y and east is +x.
  let s = localSun(sunVector(-88, 0, 0, 1), ...toMap(-88, 0));
  near(s.dx, 0, 1e-9); near(s.dy, 1, 1e-9);
  s = localSun(sunVector(-88, 0, 90, 1), ...toMap(-88, 0));
  near(s.dx, 1, 1e-9); near(s.dy, 0, 1e-9);
  // At lon 90 E (+x axis), east points toward lon 180, which is -y.
  s = localSun(sunVector(-88, 90, 90, 1), ...toMap(-88, 90));
  near(s.dx, 0, 1e-9); near(s.dy, -1, 1e-9);
});

test("smooth sphere: curvature never casts a shadow, Sun below the horizon is dark", () => {
  // The view spans ~1.4 deg of curvature, so the local Sun elevation varies by that much across it.
  const view = { cx: 60, cy: -40, half: 30 };
  const up = shadeView(flat(), sunVector(-88, 120, 200, 3), view, 8);
  assert.ok(up.every((v) => v > 0.29), "all lit when the Sun is up");
  const down = shadeView(flat(), sunVector(-88, 120, 200, -3), view, 8);
  assert.ok(down.every((v) => v <= 0.1), "all dark when the Sun is down"); // shadow keeps a faint relief, max 0.1
});

test('wide terrain renders extend the view without stretching its centre', () => {
  const terrain = flat(), sun = sunVector(-88, 120, 200, 3), view = { cx: 60, cy: -40, half: 30 };
  const square = shadeView(terrain, sun, view, 8);
  const wide = shadeView(terrain, sun, view, 16, 8);
  assert.equal(wide.length, 128);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) near(wide[y * 16 + x + 4], square[y * 8 + x], 1e-6);
});

test("panning clamps both map axes to the available terrain", () => {
  const edge = TERRAIN.half - TERRAIN.px;
  const view = mapViewport({ cx: 300, cy: -300, half: 40 }, 1.6, true);
  near(view.cx + view.half * view.aspect, edge, 1e-9);
  near(view.cy - view.half, -edge, 1e-9);
});

test("the wide whole-region map leaves room to pan on both axes", () => {
  const view = mapViewport({ cx: 20, cy: -25, half: 170 }, 1.6, false);
  assert.equal(view.cx, 20);
  assert.equal(view.cy, -25);
  assert.ok(view.cx + view.half * view.aspect < TERRAIN.half - TERRAIN.px);
});

test("a 2 km wall shadows the ground behind it, not in front", () => {
  const t = flat();
  for (let r = 0; r < t.n; r++) for (let c = 520; c < 524; c++) t.h[r * t.n + c] = 2000; // wall at x = 10..12 km
  t.hmax = 2;
  const sun = sunVector(-89.9, 90, 0, 2); // on the +x axis north is +x: Sun low toward +x
  const px = (x) => shadeView(t, sun, { cx: x, cy: 0, half: 0.1 }, 1)[0];
  assert.ok(px(5) <= 0.1, "5 km before the wall, Sun behind it: dark");
  assert.ok(px(20) > 0.29, "beyond the wall, facing the Sun: lit");
});
