import { heightAt, R_KM, TERRAIN } from './shadow.js';

const HALF = 304;
const PIXEL = 0.08;
const TILE = 800;
const DETAIL_INNER = 10;
const DETAIL_OUTER = 19;
export const SURFACE_EYE_KM = 0.0017;

export function hasSurfaceTerrain(x, y) {
  return Math.max(Math.abs(x), Math.abs(y)) <= TERRAIN.half - TERRAIN.px;
}

async function readTile(col, row, signal) {
  const url = new URL(`surface-terrain/${col}-${row}.bin`, document.baseURI);
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) throw new Error('Detailed terrain is unavailable');
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  const bytes = new DataView(await new Response(stream).arrayBuffer());
  if (bytes.byteLength !== TILE * TILE * 2) throw new Error('Invalid terrain tile');
  const heights = new Int16Array(TILE * TILE);
  for (let r = 0; r < TILE; r++) {
    let height = 0;
    for (let c = 0; c < TILE; c++) {
      const i = r * TILE + c;
      height += bytes.getInt16(i * 2, true);
      heights[i] = height;
    }
  }
  return heights;
}

export async function loadSurfaceTerrain(x, y, signal) {
  const grid = (x, y) => [(x + HALF) / PIXEL - 0.5, (HALF - y) / PIXEL - 0.5];
  const [left, top] = grid(x - DETAIL_OUTER, y + DETAIL_OUTER);
  const [right, bottom] = grid(x + DETAIL_OUTER, y - DETAIL_OUTER);
  const requests = [];
  const tiles = new Map();
  for (let r = Math.floor(top / TILE); r <= Math.floor((bottom + 1) / TILE); r++) {
    for (let c = Math.floor(left / TILE); c <= Math.floor((right + 1) / TILE); c++) {
      requests.push(readTile(c, r, signal).then(data => tiles.set(r * 10 + c, data)));
    }
  }
  await Promise.all(requests);
  function sample(c, r) {
    return tiles.get(Math.floor(r / TILE) * 10 + Math.floor(c / TILE))[(r % TILE) * TILE + c % TILE];
  }
  return (px, py) => {
    const [c, r] = grid(px, py);
    const i = Math.floor(c), j = Math.floor(r), u = c - i, v = r - j;
    return ((sample(i, j) * (1 - u) + sample(i + 1, j) * u) * (1 - v)
      + (sample(i, j + 1) * (1 - u) + sample(i + 1, j + 1) * u) * v) / 1000;
  };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function surfaceFrame(x, y) {
  const u = x / (2 * R_KM), v = y / (2 * R_KM);
  const q = 1 + u * u + v * v;
  const up = [2 * v / q, 2 * u / q, 1 - 2 / q];
  const right = [-2 * u * v / q, 1 - 2 * u * u / q, 2 * u / q];
  const forward = [1 - 2 * v * v / q, -2 * u * v / q, 2 * v / q];
  return vector => [dot(vector, right), dot(vector, forward), dot(vector, up)];
}

function surfaceElevation(terrain, regional, detail, x, y, distance) {
  const broad = heightAt(terrain, x, y);
  const edge = terrain.half - 2 * terrain.px;
  const far = Number.isFinite(broad) ? broad : regional ? heightAt(regional, x, y)
    : heightAt(terrain, Math.max(-edge, Math.min(edge, x)), Math.max(-edge, Math.min(edge, y)));
  if (distance >= DETAIL_OUTER) return far;
  const near = detail(x, y);
  const t = Math.max(0, (distance - DETAIL_INNER) / (DETAIL_OUTER - DETAIL_INNER));
  return Number.isFinite(far) ? near + (far - near) * t * t * (3 - 2 * t) : near;
}

export function surfacePanorama({ x, y, yaw, terrain, regional, detail }) {
  const ground = detail(x, y) + SURFACE_EYE_KM;
  const horizons = Array.from({ length: 72 }, (_, i) => {
    const angle = i * Math.PI / 36;
    const dx = Math.sin(angle), dy = Math.cos(angle);
    let elevation = -90, reach = 0;
    for (let d = PIXEL; d < 45; d *= 1.12) {
      const height = surfaceElevation(terrain, regional, detail, x + dx * d, y + dy * d, d);
      const slope = Math.atan2(height - ground - d * d / (2 * R_KM), d) * 180 / Math.PI;
      if (slope > elevation) { elevation = slope; reach = d; }
    }
    return { elevation, reach };
  });
  let best = { yaw, pitch: -7 }, bestScore = -Infinity;
  for (let i = 0; i < horizons.length; i++) {
    const sector = [-4, -2, 0, 2, 4].map(offset => horizons[(i + offset + 72) % 72]);
    const angles = sector.map(point => point.elevation);
    const top = Math.max(...angles), bottom = Math.min(...angles);
    const reach = sector.reduce((sum, point) => sum + Math.log1p(point.reach), 0) / sector.length;
    const heading = i * 5;
    const turn = Math.abs(((heading - yaw + 540) % 360) - 180);
    const score = top - bottom + 2.3 * reach + 0.2 * top - turn / 120;
    if (score <= bestScore) continue;
    bestScore = score;
    best = { yaw: heading, pitch: Math.max(-18, Math.min(19, (top + bottom) / 2 - 6)) };
  }
  return best;
}

export function surfaceMesh({ x, y, terrain, regional, detail }) {
  const positive = [0];
  for (let i = 0; i < 210; i++) {
    const step = i < 125 ? PIXEL : Math.min(4, PIXEL * 1.065 ** (i - 124));
    positive.push(positive[i] + step);
  }
  const coords = [...positive.slice(1).reverse().map(v => -v), ...positive];
  const n = coords.length;
  const vertices = new Float32Array(n * n * 6);
  const indices = new Uint32Array((n - 1) ** 2 * 6);
  const frame = surfaceFrame(x, y);
  const origin = R_KM + detail(x, y);
  for (let r = 0, i = 0; r < n; r++) {
    for (let c = 0; c < n; c++, i += 6) {
      const dx = coords[c], dy = coords[r];
      const px = x + dx, py = y + dy;
      const h = surfaceElevation(terrain, regional, detail, px, py, Math.hypot(dx, dy));
      const u = px / (2 * R_KM), v = py / (2 * R_KM), q = 1 + u * u + v * v;
      const p = frame([2 * v / q, 2 * u / q, 1 - 2 / q]);
      vertices[i] = p[0] * (R_KM + h);
      vertices[i + 1] = p[1] * (R_KM + h);
      vertices[i + 2] = p[2] * (R_KM + h) - origin;
    }
  }
  for (let r = 0, k = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c, offset = i * 6;
      const left = (c ? i - 1 : i) * 6, right = (c < n - 1 ? i + 1 : i) * 6;
      const down = (r ? i - n : i) * 6, up = (r < n - 1 ? i + n : i) * 6;
      const ax = vertices[right] - vertices[left];
      const ay = vertices[right + 1] - vertices[left + 1];
      const az = vertices[right + 2] - vertices[left + 2];
      const bx = vertices[up] - vertices[down];
      const by = vertices[up + 1] - vertices[down + 1];
      const bz = vertices[up + 2] - vertices[down + 2];
      const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const length = Math.hypot(nx, ny, nz);
      vertices[offset + 3] = nx / length;
      vertices[offset + 4] = ny / length;
      vertices[offset + 5] = nz / length;
      if (r < n - 1 && c < n - 1) {
        indices[k++] = i;
        indices[k++] = i + 1;
        indices[k++] = i + n;
        indices[k++] = i + 1;
        indices[k++] = i + n + 1;
        indices[k++] = i + n;
      }
    }
  }
  return { vertices, indices };
}
