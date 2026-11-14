import { test } from "node:test";
import assert from "node:assert/strict";
import { sunLongitude, scene, introResolution } from "./intro.js";

const RAD = Math.PI / 180;
const near = (a, b, tol) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test('intro final camera keeps every screen corner inside the detailed terrain', () => {
  for (const [w, h, dpr] of [[1920,1080,1], [3840,2160,2], [2560,1080,1], [390,844,3]]) {
    const q = introResolution(w,h,dpr);
    const longHalf = q.half * Math.max(w,h) / Math.min(w,h);
    assert.ok(Math.hypot(q.half, longHalf) < 250 * 0.94, 'corners must avoid the fading rim');
    assert.ok(q.terrain >= 800 && q.terrain <= 1280);
    assert.ok(q.sphere >= 768 && q.sphere <= 1536);
  }
});

test("Sun longitude: 0 deg at the March 2026 equinox, 90 at the June solstice", () => {
  near(angDiff(sunLongitude(Date.UTC(2026, 2, 20, 14, 46)), 0), 0, 0.1);
  near(angDiff(sunLongitude(Date.UTC(2026, 5, 21, 8, 24)), 90), 0, 0.1);
});

test("scene: Moon->Earth points up and the Sun sits where the polar map puts it", () => {
  const ms = Date.UTC(2026, 10, 20);
  for (const ss of [0, 37, 90, 180, -90]) {
    const p = scene(ms, [Math.cos(ss * RAD), Math.sin(ss * RAD), 0]);
    near(Math.atan2(p.earth[0] - p.moon[0], p.earth[1] - p.moon[1]), 0, 1e-9);
    // On the map the Sun at sub-solar longitude ss is at (right, up) = (sin ss, cos ss).
    const n = Math.hypot(...p.moon);
    near(-p.moon[0] / n, Math.sin(ss * RAD), 0.003); // 0.003 = Earth-Moon parallax of the Sun
    near(-p.moon[1] / n, Math.cos(ss * RAD), 0.003);
  }
  const full = scene(ms, [1, 0, 0]), fresh = scene(ms, [-1, 0, 0]);
  assert.ok(Math.hypot(...full.moon) > Math.hypot(...full.earth), "full Moon: beyond the Earth");
  assert.ok(Math.hypot(...fresh.moon) < Math.hypot(...fresh.earth), "new Moon: between Earth and Sun");
});
