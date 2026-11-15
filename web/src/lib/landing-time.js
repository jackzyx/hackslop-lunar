import { MAX_DELAY_D } from '../domain/metrics.js';

// The planner's data is hourly. Reserve room for both slip sliders and the 30-day window.
export function initialLandingTime(start, count, now = Date.now()) {
  const hour = 3600000, day = 24 * hour;
  const min = start + (MAX_DELAY_D + 1) * day;
  const max = start + count * hour - (MAX_DELAY_D + 32) * day;
  return Math.max(min, Math.min(max, Math.floor(now / hour) * hour));
}
