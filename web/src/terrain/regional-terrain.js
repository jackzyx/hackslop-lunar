import { heightAt, terrainFrom } from './shadow.js';

export const APPROACH_TERRAIN = { n: 1200, px: 1.5, half: 900 };

let approach;
export function loadRegionalTerrain() {
  return approach ??= fetch(new URL('terrain_approach_1500m.bin', document.baseURI), {
    signal: AbortSignal.timeout(10000),
  }).then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.arrayBuffer();
  }).then(buffer => terrainFrom(buffer, APPROACH_TERRAIN)).catch(() => {
    approach = undefined;
    return null;
  });
}

const sides = [[-1, 1, 2, 0], [1, 1, 0, -2], [1, -1, -2, 0], [-1, -1, 0, 2]];
const spacingAt = distance => 3 - 1.5 * Math.exp(-distance / 18) + distance * 0.06;

export function regionalRelief(wide) {
  const step = 2;
  const size = Math.floor(wide.n / step);
  const pixels = new Uint8Array(size * size);
  const edge = wide.n - 1;
  const slopeScale = 4 / (2000 * wide.px * step);
  for (let row = 0; row < size; row++) {
    const y = row * step + 1;
    const north = Math.max(0, y - step) * wide.n;
    const south = Math.min(edge, y + step) * wide.n;
    for (let column = 0; column < size; column++) {
      const x = column * step + 1;
      const offset = y * wide.n;
      const west = wide.h[offset + Math.max(0, x - step)];
      const east = wide.h[offset + Math.min(edge, x + step)];
      const relief = 0.5 + (west - east + wide.h[north + x] - wide.h[south + x]) * slopeScale;
      pixels[row * size + column] = Math.round(255 * Math.max(0, Math.min(1, relief)));
    }
  }
  return { size, pixels };
}

export function regionalMesh(core, wide, segments, coreHalf, cx, cy) {
  const pos = [], idx = [];
  const edge = (half, side, fraction) => [cx + half * (side[0] + side[2] * fraction), cy + half * (side[1] + side[3] * fraction)];
  const innerHeight = (side, fraction) => {
    const along = fraction * segments;
    const i = Math.min(segments - 1, Math.floor(along));
    const a = heightAt(core, ...edge(coreHalf, side, i / segments));
    const b = heightAt(core, ...edge(coreHalf, side, (i + 1) / segments));
    return a + (b - a) * (along - i);
  };

  function ring(half, count) {
    const start = pos.length / 3;
    const distance = half - coreHalf;
    const fade = Math.min(1, distance / 42);
    const blend = fade * fade * (3 - 2 * fade);
    const sampleStep = spacingAt(distance);
    const sampleLimit = wide.half - wide.px;
    const sample = (x, y) => heightAt(wide,
      Math.max(-sampleLimit, Math.min(sampleLimit, x)),
      Math.max(-sampleLimit, Math.min(sampleLimit, y)));

    for (const side of sides) {
      for (let i = 0; i < count; i++) {
        const f = i / count;
        const [x, y] = edge(half, side, f);
        if (distance === 0) {
          pos.push(x, y, heightAt(core, x, y));
          continue;
        }
        const offset = sampleStep / 2;
        const west = sample(x - offset, y), east = sample(x + offset, y);
        const north = sample(x, y + offset), south = sample(x, y - offset);
        let z = sample(x, y);
        z += ((west + east + north + south) / 4 - z) * blend / 2;
        if (blend < 1) z += (innerHeight(side, f) - sample(...edge(coreHalf, side, f))) * (1 - blend);
        pos.push(x, y, z);
      }
    }
    return { start, count };
  }

  const outerHalf = wide.half - wide.px - Math.max(Math.abs(cx), Math.abs(cy));
  let half = coreHalf;
  let inner = ring(half, segments);
  while (half < outerHalf) {
    half = Math.min(outerHalf, half + spacingAt(half - coreHalf));
    const outer = ring(half, Math.ceil(2 * half / spacingAt(half - coreHalf)));
    for (let side = 0; side < sides.length; side++) {
      let i = 0, j = 0;
      const vertex = (r, offset) => r.start + (side * r.count + offset) % (sides.length * r.count);
      while (i < inner.count || j < outer.count) {
        const a = vertex(inner, i), b = vertex(outer, j);
        if (j === outer.count || (i < inner.count && (i + 1) * outer.count <= (j + 1) * inner.count)) {
          idx.push(a, vertex(inner, ++i), b);
        } else {
          idx.push(a, vertex(outer, ++j), b);
        }
      }
    }
    inner = outer;
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
