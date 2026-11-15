// Positions are interpolated in MOON_ME, then projected from the lunar south pole.
// Map right = lunar Y, map up = lunar X. This preserves Earth libration and distance.
export function realtimeScene(metadata, buffer, ms = Date.now()) {
  const { startUtc, stepMs, count } = metadata.ephemeris;
  const index = (ms - Date.parse(startUtc)) / stepMs;
  if (!Number.isFinite(index) || index < 0 || index > count - 1 || buffer.byteLength !== count * 6 * 8) {
    throw new RangeError('Current UTC time is outside the intro ephemeris coverage');
  }
  const data = new DataView(buffer);
  const lo = Math.min(Math.floor(index), count - 2), fraction = index - lo;
  const vector = offset => [0, 1, 2].map(axis => {
    const a = data.getFloat64(((lo * 6) + offset + axis) * 8, true);
    const b = data.getFloat64((((lo + 1) * 6) + offset + axis) * 8, true);
    return a + (b - a) * fraction;
  });
  const sunPosition = vector(0), earthPosition = vector(3);
  const length = Math.hypot(...sunPosition);
  const sun = sunPosition.map(value => value / length);
  const moon = [-sunPosition[1], -sunPosition[0]];
  const earth = [moon[0] + earthPosition[1], moon[1] + earthPosition[0]];
  return {
    ...metadata, ms, sun, positions: { sun: [0, 0], moon, earth },
    when: new Intl.DateTimeFormat('en-IE', {
      timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(ms)) + ' UTC',
  };
}

let positionsReady;
export async function loadRealtimeScene(metadata) {
  positionsReady ??= fetch(new URL(metadata.ephemeris.url, document.baseURI)).then(response => {
    if (!response.ok) throw new Error('Intro position data unavailable');
    return response.arrayBuffer();
  }).catch(error => { positionsReady = undefined; throw error; });
  const buffer = await positionsReady;
  return realtimeScene(metadata, buffer, Date.now());
}
