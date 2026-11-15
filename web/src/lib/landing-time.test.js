import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialLandingTime } from './landing-time.js';

test('planner starts at the current UTC hour, rather than the old fixed date', () => {
  const start = Date.parse('2025-01-01T00:00:00Z'), count = 52584;
  const now = Date.parse('2026-11-15T23:45:12Z');
  assert.equal(initialLandingTime(start, count, now), Date.parse('2026-11-15T23:00:00Z'));
  const earliest = initialLandingTime(start, count, start - 1e10);
  const latest = initialLandingTime(start, count, start + 1e15);
  assert.ok(earliest - (60 * 24 + 23) * 3600000 >= start);
  assert.ok(latest + (60 * 24 + 23 + 23 + 720) * 3600000 <= start + count * 3600000);
});
