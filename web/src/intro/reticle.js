export const LOCK_DELAY = 0.42;
const ease = value => { const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x); };

export function cameraProgress(time, start, end) {
  return ease((time - start - LOCK_DELAY) / (end - start - LOCK_DELAY));
}

export function reticleState(time, points, radii) {
  const [start, previous, target] = time < 2 ? [0, 'sun', 'earth'] : time < 3.6 ? [2, 'earth', 'moon'] : [3.6, 'moon', 'landing'];
  const acquire = ease((time - start) / 0.24);
  const center = points[previous].map((value, i) => value + (points[target][i] - value) * acquire);
  const size = body => Math.min(80, Math.max(24, (radii[body] ?? 32) * 1.1 + 10));
  const previousRadius = size(previous), targetRadius = size(target);
  return {
    center, target, locked: time >= start + 0.24,
    radius: previousRadius + (targetRadius - previousRadius) * acquire,
    split: ease((time - 4.8) / 0.6),
  };
}

export function reticleCorners(state, sites) {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy], index) => {
    const site = sites[index % 2];
    const radius = state.radius + (22 - state.radius) * state.split;
    return {
      x: state.center[0] + (site[0] - state.center[0]) * state.split + sx * radius - (sx > 0 ? 12 : 0),
      y: state.center[1] + (site[1] - state.center[1]) * state.split + sy * radius - (sy > 0 ? 12 : 0),
    };
  });
}
