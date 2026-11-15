import test from 'node:test';
import assert from 'node:assert/strict';
import { sunLightMatrix } from './surface-renderer.js';

test('sun light matrix maps strip terrain into the shadow map, nearest-to-Sun at depth -1', () => {
  const el = 1.5 * Math.PI / 180, sun = [0, Math.cos(el), Math.sin(el)];
  const points = [[0, 0, 0], [0, 150, -6], [0, -150, -6], [30, 20, 2], [-39, -80, 1], [200, 0, -11]];
  const vertices = new Float32Array(points.flatMap(p => [...p, 0, 0, 1]));
  const m = sunLightMatrix(vertices, sun);
  const project = ([x, y, z]) => [0, 1, 2].map(r => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r]);
  for (const p of points.slice(0, 5)) for (const v of project(p)) assert.ok(Math.abs(v) <= 1, `${p} -> ${project(p)}`);
  assert.ok(project([0, 150, -6])[2] < project([0, -150, -6])[2], 'sunward point is nearer');
  assert.ok(Math.abs(project([200, 0, -11])[0]) > 1, 'outside the strip falls off the map');
});
