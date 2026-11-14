import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraMatrix, project } from "./terrain-3d.js";

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
