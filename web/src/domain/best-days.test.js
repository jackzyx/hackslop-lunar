import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyWindows, bestDays } from './best-days.js';
import { WINDOW_H, windowMetrics } from './metrics.js';

test('best landing days score the selected hour rather than midnight', () => {
  const sun = new Float32Array(WINDOW_H + 48);
  const earth = new Uint8Array(sun.length);
  sun.fill(1, WINDOW_H);
  earth.fill(1, WINDOW_H + 6);
  const visibility = { sun, earth };
  const midnight = dailyWindows(visibility, 0, 2);
  const evening = dailyWindows(visibility, 23, 2);
  assert.equal(evening[0].sunlit - midnight[0].sunlit, 23);
  assert.equal(evening[0].earth - midnight[0].earth, 17);
  for (const row of evening) {
    assert.equal(row.i % 24, 23);
    const metrics = windowMetrics(visibility, row.i);
    assert.equal(row.sunlit, metrics.sunlit);
    assert.equal(row.earth, metrics.earth);
  }
  assert.equal(bestDays(evening, 'both')[0].i, 47);
  assert.equal(dailyWindows(visibility, 48, 1).length, 1);
  assert.equal(dailyWindows(visibility, 49, 1).length, 0);
});
