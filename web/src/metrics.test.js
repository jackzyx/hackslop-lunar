import { test } from "node:test";
import assert from "node:assert/strict";
import { maskAt, sunFraction, windowMetrics, verdictDelay, rig, SUN_RADIUS_DEG, WINDOW_H } from "./metrics.js";

test("sunFraction: half disc on the skyline, none below, all above", () => {
  assert.equal(sunFraction(1.0, 1.0), 0.5);
  assert.equal(sunFraction(1.0 - SUN_RADIUS_DEG, 1.0), 0);
  assert.equal(sunFraction(1.0 + SUN_RADIUS_DEG, 1.0), 1);
  assert.ok(sunFraction(1.1, 1.0) > 0.5 && sunFraction(1.1, 1.0) < 1);
});

test("maskAt interpolates and wraps at 360 deg", () => {
  const mask = new Array(720).fill(0);
  mask[719] = 2; // 359.5 deg
  assert.equal(maskAt(mask, 359.75), 1);
  assert.equal(maskAt(mask, -0.5), 2);
  assert.equal(maskAt(mask, 0), 0);
});

test("windowMetrics: dark gap, sunset and Earthset timing", () => {
  const sun = new Float32Array(WINDOW_H).fill(1), earth = new Uint8Array(WINDOW_H);
  sun.fill(0, 10, 40); // 30 h dark
  sun.fill(0, 100, 105);
  earth.fill(1, 0, 7);
  const m = windowMetrics({ sun, earth }, 0);
  assert.equal(m.darkGap, 30);
  assert.equal(m.sunlit, WINDOW_H - 35);
  assert.equal(m.earth, 7);
  assert.equal(m.sunsetIn, 10);
  assert.equal(m.earthsetIn, 7);
  assert.equal(windowMetrics({ sun, earth }, 20).sunsetIn, null); // Sun already down
});

test("verdictDelay finds the first delay under half sunlight", () => {
  const n = WINDOW_H + 61 * 24, sun = new Float32Array(n).fill(1), earth = new Uint8Array(n);
  sun.fill(0, 400); // dark from hour 400: window starting at day d has 400 - 24 d lit hours
  assert.equal(verdictDelay({ sun, earth }, 0), 2); // 400 - 48 = 352 < 360
  assert.equal(verdictDelay({ sun: new Float32Array(n).fill(1), earth }, 0), null);
});

test("rig: 157 mm per degree of sub-solar latitude at 3 m, k = 3", () => {
  const r = rig(-10, -1);
  assert.equal(r.tableDeg, 350);
  assert.ok(Math.abs(r.lampMm - 157.10) < 0.01); // 3000 mm x 3 x tan(1 deg)
});
