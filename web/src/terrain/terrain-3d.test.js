import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraMatrix, project, hidden, pickTerrain, EXAG } from "./terrain-3d.js";
import { TERRAIN } from "./shadow.js";

test("orbit camera puts its target at the centre and lon 0 (+y) up the screen when looking from 180", () => {
  const cam = { target: [20, -10, 1], yaw: 180, pitch: 40, dist: 300 };
  const m = cameraMatrix(cam, 1.5);
  const [x, y] = project(m, cam.target, 600, 400);
  assert.ok(Math.abs(x - 300) < 1e-6 && Math.abs(y - 200) < 1e-6, `${x},${y}`);
  const [, yFar] = project(m, [20, 40, 1], 600, 400);
  assert.ok(yFar < 200, "a point toward lon 0 sits higher on screen");
  const [xEast] = project(m, [70, -10, 1], 600, 400);
  assert.ok(xEast > 300, "+x (90 E) is to the right");
  assert.equal(project(m, [20, -800, 300], 600, 400), null, "points behind the eye are dropped");
});

test("a ridge between the eye and a pin hides it; flat ground does not", () => {
  const t = { ...TERRAIN, h: new Int16Array(TERRAIN.n ** 2) };
  const eye = [0, -100, 2 * EXAG], pin = [0, 0, 0];
  assert.equal(hidden(t, eye, pin), false);
  for (let r = 0; r < t.n; r++) for (let c = 0; c < t.n; c++) if (Math.abs(t.half - (r + 0.5) * t.px + 50) < 2) t.h[r * t.n + c] = 3000; // 3 km ridge along y = -50
  assert.equal(hidden(t, eye, pin), true);
  assert.equal(hidden(t, [0, -100, 20 * EXAG], pin), false, "seen from high above the ridge");
});

test("the center ray picks the same coordinates at natural and exaggerated terrain heights", () => {
  const terrain = { n: 12, px: 1, half: 6, h: new Int16Array(144).fill(2000) };
  for (const exag of [1, EXAG]) {
    const target = [0, 0, 2 * exag];
    const cam = { target, yaw: 180, pitch: 40, dist: 12 };
    const hit = pickTerrain(terrain, null, cam, 0, 0, 1, undefined, exag);
    assert.ok(hit);
    assert.ok(Math.hypot(...hit.map((value, axis) => value - target[axis])) < 0.002);
  }
});
