import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyWindows, hourlyWindows, bestDays } from './best-days.js';
import { WINDOW_H, windowMetrics } from './metrics.js';

test('optimal times search all hours and find an interior hour, with earliest ties', () => {
  const sun = new Float32Array(WINDOW_H + 48);
  sun.fill(1, 7, WINDOW_H + 7);
  const earth = Uint8Array.from(sun);
  const rows = hourlyWindows({ sun, earth }, 0, 1);
  assert.equal(rows.length, 24);
  for (const goal of ['sunlit', 'earth', 'both']) {
    assert.equal(bestDays(rows, goal)[0].i, 7);
  }
  const flat = { sun: new Float32Array(WINDOW_H + 48).fill(1), earth: new Uint8Array(WINDOW_H + 48).fill(1) };
  assert.equal(bestDays(hourlyWindows(flat, 0, 2), 'sunlit')[0].i, 0);
  assert.equal(hourlyWindows(flat, 0, 3).at(-1).i, 48);
});

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
