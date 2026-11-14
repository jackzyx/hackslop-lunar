import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dailyWindows, hourlyWindows, bestDays, GOALS } from './best-days.js';
import { WINDOW_H, windowMetrics, visibility } from './metrics.js';

test('shipped sites: hourly recommendations match direct 30-day scoring and preserve UTC time', () => {
  const data = JSON.parse(readFileSync(new URL('../data/ephemeris.json', import.meta.url)));
  const start = Date.parse(data.ephemeris.start_utc);
  const hourMs = 3_600_000;
  const iFrom = (Date.parse('2026-11-20T00:00:00Z') - start) / hourMs;
  for (const site of data.sites) {
    const vis = visibility(site.horizon, data.ephemeris.sites[site.id]);
    const rows = hourlyWindows(vis, iFrom, 365);
    assert.equal(rows.length, 365 * 24, site.id);
    const reference = rows.map(row => ({ ...row, ...windowMetrics(vis, row.i) }));
    for (let k = 0; k < rows.length; k++) {
      assert.ok(Math.abs(rows[k].sunlit - reference[k].sunlit) < 1e-6, `${site.id} sunlight at hour ${k}`);
      assert.equal(rows[k].earth, reference[k].earth);
    }
    for (const [goal, { score }] of Object.entries(GOALS)) {
      const picked = bestDays(rows, goal);
      assert.equal(picked.length, 3);
      const accepted = [];
      for (const row of picked) {
        const eligible = reference.filter(candidate => accepted.every(previous => Math.abs(candidate.i - previous.i) >= 7 * 24));
        const maximum = Math.max(...eligible.map(score));
        assert.ok(Math.abs(score(row) - maximum) < 1e-6, `${site.id} ${goal} optimal score`);
        const earliest = eligible.find(candidate => Math.abs(score(candidate) - maximum) < 1e-9);
        assert.equal(row.i, earliest.i, `${site.id} ${goal} earliest tie`);
        const timestamp = new Date(start + row.i * hourMs);
        const day = timestamp.toISOString().slice(0, 10);
        const hour = timestamp.getUTCHours();
        const restored = (Date.parse(`${day}T00:00:00Z`) - start) / hourMs + hour;
        assert.equal(restored, row.i, `${site.id} ${goal} LAND preserves date and UTC hour`);
        accepted.push(row);
      }
    }
  }
});

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
