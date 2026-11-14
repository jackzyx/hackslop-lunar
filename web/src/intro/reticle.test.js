import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraProgress, reticleState, reticleCorners } from './reticle.js';

const points = { sun: [300, 200], earth: [500, 280], moon: [650, 300], landing: [670, 310] };
const radii = { earth: 18, moon: 30, landing: 12 };

test('each target locks before its camera movement begins', () => {
  for (const [start, end, target] of [[0, 2, 'earth'], [2, 3.6, 'moon'], [3.6, 5.4, 'landing']]) {
    const locked = reticleState(start + 0.3, points, radii);
    assert.equal(locked.target, target);
    assert.equal(locked.locked, true);
    assert.deepEqual(locked.center, points[target]);
    assert.equal(cameraProgress(start + 0.3, start, end), 0);
    assert.ok(cameraProgress(start + 0.6, start, end) > 0);
    assert.equal(cameraProgress(end, start, end), 1);
  }
});

test('reticle separates into diagonal brackets for both landing sites', () => {
  const sites = [[620, 330], [730, 260]];
  const state = reticleState(5.4, points, radii);
  assert.equal(state.split, 1);
  const corners = reticleCorners(state, sites);
  assert.deepEqual(corners[0], { x: 598, y: 308 });
  assert.deepEqual(corners[2], { x: 630, y: 340 });
  assert.deepEqual(corners[1], { x: 740, y: 238 });
  assert.deepEqual(corners[3], { x: 708, y: 270 });
});
