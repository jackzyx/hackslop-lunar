import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { realtimeScene } from './realtime-scene.js';

const ephemeris = JSON.parse(readFileSync(new URL('../data/intro-ephemeris.json', import.meta.url)));
const bytes = readFileSync(new URL('../../public/intro-positions.bin', import.meta.url));
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const metadata = { ephemeris, picks: [] };

test('realtime intro uses the requested UTC instant and preserves lunar-axis projection', () => {
  const ms = Date.parse('2026-11-15T12:34:56Z');
  const result = realtimeScene(metadata, buffer, ms);
  assert.equal(result.ms, ms);
  assert.match(result.when, /12:34.*UTC/);
  assert.ok(Math.abs(Math.hypot(...result.sun) - 1) < 1e-12);
  const a = realtimeScene(metadata, buffer, Date.parse('2026-11-15T12:00:00Z'));
  const b = realtimeScene(metadata, buffer, Date.parse('2026-11-15T13:00:00Z'));
  const mid = realtimeScene(metadata, buffer, Date.parse('2026-11-15T12:30:00Z'));
  for (const body of ['moon', 'earth']) for (let axis = 0; axis < 2; axis++) {
    assert.ok(Math.abs(mid.positions[body][axis] - (a.positions[body][axis] + b.positions[body][axis]) / 2) < 1e-6);
  }
  const distance = Math.hypot(...a.positions.moon);
  assert.ok(Math.abs(-a.positions.moon[0] / distance - a.sun[1] / Math.hypot(a.sun[0], a.sun[1])) < 1e-12);
  const later = realtimeScene(metadata, buffer, ms + 10 * 86400000);
  const direction = scene => scene.positions.earth.map((value, i) => value - scene.positions.moon[i]);
  assert.notDeepEqual(direction(result), direction(later));
  assert.ok(Math.abs(direction(result)[0]) > 100, 'Earth is not pinned to the vertical axis');
});

test('intro Earth vector agrees with the cached JPL Horizons near-pole reference', () => {
  const ms = Date.parse('2026-11-14T12:00:00Z');
  const i = (ms - Date.parse(ephemeris.startUtc)) / ephemeris.stepMs;
  const values = new DataView(buffer);
  const earth = [0, 1, 2].map(axis => values.getFloat64((i * 6 + 3 + axis) * 8, true));
  const lat = -89.9 * Math.PI / 180;
  const up = [Math.cos(lat), 0, Math.sin(lat)], north = [-Math.sin(lat), 0, Math.cos(lat)];
  const direction = earth.map((value, axis) => value - 1737.4 * up[axis]);
  const dot = vector => direction.reduce((sum, value, axis) => sum + value * vector[axis], 0);
  const az = (Math.atan2(direction[1], dot(north)) * 180 / Math.PI + 360) % 360;
  const el = Math.atan2(dot(up), Math.hypot(direction[1], dot(north))) * 180 / Math.PI;
  assert.ok(Math.abs(az - 358.077226) < 0.001);
  assert.ok(Math.abs(el - -4.021498) < 0.001);
});

test('intro handles coverage endpoints and rejects times outside the table', () => {
  const first = Date.parse(ephemeris.startUtc), last = first + (ephemeris.count - 1) * ephemeris.stepMs;
  assert.ok(realtimeScene(metadata, buffer, first).sun.every(Number.isFinite));
  assert.ok(realtimeScene(metadata, buffer, last).sun.every(Number.isFinite));
  assert.throws(() => realtimeScene(metadata, buffer, first - 1), RangeError);
  assert.throws(() => realtimeScene(metadata, buffer, last + 1), RangeError);
});
