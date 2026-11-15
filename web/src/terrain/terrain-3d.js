// World axes: x, y in map km (+y toward lon 0), z = height km x EXAG.
import { createGPUShadow } from './shadow-gpu.js';
import { heightAt, R_KM } from './shadow.js';
import { regionalMesh, regionalRelief } from './regional-terrain.js';
import { createTerrainMarkers } from './terrain-markers.js';

export const EXAG = 4; // vertical exaggeration, shown on screen
const STEP = 2; // mesh vertex every 2 grid pixels = 1 km
const CONTOUR_KM = 0.5, MAJOR_KM = 2, GRID_KM = 25;

const vertex = `#version 300 es
in vec3 pos;
uniform mat4 mvp;
uniform float exag;
out vec3 v;
void main() { v = pos; gl_Position = mvp * vec4(pos.xy, pos.z * exag, 1.0); }`;
const fragment = `#version 300 es
precision highp float;
in vec3 v;
uniform sampler2D shade;
uniform sampler2D reliefMap;
uniform sampler2D moonMap;
uniform vec3 amber, sun;
uniform vec3 sunDirection;
uniform vec3 invalidTint;
uniform vec4 targets[3];
uniform int targetCount;
uniform float halfKm, reliefHalf;
uniform bool expanded, moonSurface;
out vec4 color;
float line(float f) { return 1.0 - min(abs(fract(f - 0.5) - 0.5) / max(fwidth(f), 1e-5), 1.0); }
float markerRing(float radius, float center, float width, float aa) {
  return 1.0 - smoothstep(width, width + aa, abs(radius - center));
}
float moonAlbedo(float radius) {
  const float pi = 3.141592653589793;
  float lon = radius > 0.0 ? atan(v.x, v.y) : 0.0;
  float colat = 2.0 * atan(radius / ${2 * R_KM});
  vec2 uv = vec2(0.5 + lon / (2.0 * pi), 1.0 - colat / pi);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  dx.x -= round(dx.x);
  dy.x -= round(dy.x);
  vec3 albedo = textureGrad(moonMap, uv, dx, dy).rgb;
  return mix(0.4, 1.0, dot(albedo, vec3(0.2126, 0.7152, 0.0722)));
}
float regionalSunlight(float relief) {
  vec2 p = v.xy / ${2 * R_KM};
  vec3 up = normalize(vec3(2.0 * p.yx, dot(p, p) - 1.0));
  float incidence = max(0.0, dot(up, sunDirection));
  return 0.06 + 0.8 * sqrt(incidence) * mix(0.65, 1.0, relief);
}
void main() {
  float radius = length(v.xy);
  float albedo = moonSurface ? moonAlbedo(radius) : 1.0;
  float opacity = expanded ? 1.0 - smoothstep(740.0, 895.0, radius) : 1.0;
  if (opacity <= 0.0) discard;
  float detailRadius = halfKm - 1.0;
  float beyond = expanded ? max(radius - detailRadius, 0.0) : 0.0;
  float shadowWeight = expanded ? 1.0 - smoothstep(detailRadius - 63.0, detailRadius, radius) : 1.0;
  vec3 c = vec3(0.0);
  if (shadowWeight < 1.0) {
    vec2 uv = vec2(v.x + reliefHalf, reliefHalf - v.y) / (2.0 * reliefHalf);
    float relief = textureLod(reliefMap, uv, log2(1.0 + beyond / 75.0)).r;
    c = moonSurface ? vec3(albedo * regionalSunlight(relief)) : amber * (0.08 + 0.27 * relief);
  }
  if (shadowWeight > 0.0) {
    vec2 p = clamp(v.xy, vec2(1.0 - halfKm), vec2(halfKm - 1.0));
    vec4 s = textureLod(shade, vec2(p.x + halfKm, halfKm - p.y) / (2.0 * halfKm), 0.0);
    float b = clamp((s.r * 255.0 - 14.0) / 226.0, 0.0, 1.0);
    vec3 lit;
    if (moonSurface) {
      lit = vec3(albedo * (0.055 + 0.945 * b));
    } else {
      float grid = max(line(v.x / ${GRID_KM.toFixed(1)}), line(v.y / ${GRID_KM.toFixed(1)}));
      lit = mix(amber * 0.04, mix(amber, sun, b * b), b) + amber * 0.1 * grid;
    }
    c = mix(c, lit, shadowWeight);
  }
  if (!moonSurface && beyond < 180.0) {
    float minor = mix(0.45, 1.0, shadowWeight) * (1.0 - smoothstep(0.0, 90.0, beyond));
    float major = 1.0 - smoothstep(15.0, 180.0, beyond);
    c += amber * (0.3 * minor * line(v.z / ${CONTOUR_KM.toFixed(1)}) + 0.55 * major * line(v.z / ${MAJOR_KM.toFixed(1)}));
  }
  if (!moonSurface) c *= 0.84 + 0.16 * step(1.0, mod(gl_FragCoord.y, 3.0));
  for (int i = 0; i < targetCount; i++) {
    vec4 target = targets[i];
    float r = length(v.xy - target.xy) / target.z;
    float aa = clamp(fwidth(r), 0.0005, 0.004);
    float outer = markerRing(r, 0.019, 0.0013, aa);
    float inner = markerRing(r, 0.012, 0.0008, aa) * 0.68;
    float center = 1.0 - smoothstep(0.003, 0.003 + aa, r);
    float strength = max(center, max(outer, inner));
    vec3 tint = mix(amber, invalidTint, target.w);
    c = mix(c, mix(tint, vec3(1.0, 0.94, 0.82), center), strength);
  }
  color = vec4(c * opacity, opacity);
}`;

// --- column-major 4x4 matrices
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), d = near - far;
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / d, -1, 0, 0, 2 * far * near / d, 0];
}
function lookAt(eye, target) {
  const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const z = unit(sub(eye, target)), x = unit(cross([0, 0, 1], z)), y = cross(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
}
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

// Orbit camera: yaw is the map bearing from the target to the eye (180 = looking toward lon 0).
export function eyeOf({ target, yaw, pitch, dist }) {
  const y = yaw * Math.PI / 180, p = pitch * Math.PI / 180;
  return [target[0] + dist * Math.cos(p) * Math.sin(y), target[1] + dist * Math.cos(p) * Math.cos(y), target[2] + dist * Math.sin(p)];
}
export function cameraMatrix(cam, aspect) {
  return mul(perspective(40 * Math.PI / 180, aspect, cam.dist * 0.02, cam.dist * 3 + 800), lookAt(eyeOf(cam), cam.target));
}

export function panCamera(cam, dx, dy, viewportHeight, terrain, regional) {
  const yaw = cam.yaw * Math.PI / 180, pitch = cam.pitch * Math.PI / 180;
  const scale = 2 * cam.dist * Math.tan(20 * Math.PI / 180) / viewportHeight;
  const forward = dy / Math.max(0.3, Math.sin(pitch));
  let x = cam.target[0] + scale * (dx * Math.cos(yaw) - forward * Math.sin(yaw));
  let y = cam.target[1] - scale * (dx * Math.sin(yaw) + forward * Math.cos(yaw));
  if (regional) {
    const radius = Math.hypot(x, y), limit = regional.half * 0.85;
    if (radius > limit) {
      x *= limit / radius;
      y *= limit / radius;
    }
  } else {
    const limit = terrain.half - terrain.px * STEP;
    x = Math.max(-limit, Math.min(limit, x));
    y = Math.max(-limit, Math.min(limit, y));
  }
  return { ...cam, target: [x, y, cam.target[2]] };
}

// True when the terrain rises above the sight line from the eye to a ground point (world units).
// Skips the last 1 km next to the point (its own surface) and allows 50 m of mesh-vs-grid slack.
export function hidden(t, eye, [x, y, z], exag = EXAG) {
  const dx = x - eye[0], dy = y - eye[1], len = Math.hypot(dx, dy);
  if (len <= 1) return false;
  const n = Math.min(800, Math.ceil(len / (t.px / 2))), end = 1 - 1 / len;
  for (let i = 1; i < n && i / n < end; i++) {
    const f = i / n, h = heightAt(t, eye[0] + dx * f, eye[1] + dy * f);
    if (h * exag > eye[2] + (z - eye[2]) * f + 0.05 * exag) return true;
  }
  return false;
}

// World point -> CSS pixels in a w x h viewport; null when behind the camera.
export function project(m, [x, y, z], w, h) {
  const c = [0, 1, 3].map(r => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r]);
  if (c[2] <= 0) return null;
  return [(c[0] / c[2] + 1) / 2 * w, (1 - c[1] / c[2]) / 2 * h];
}

export function terrainSurfaceHeight(terrain, x, y, exag = EXAG) {
  const stride = terrain.px * STEP;
  const c = (x + terrain.half - terrain.px / 2) / stride;
  const r = (terrain.half - y - terrain.px / 2) / stride;
  const last = Math.floor((terrain.n - 1) / STEP);
  if (!(c >= 0 && r >= 0 && c < last && r < last)) return NaN;
  const col = Math.floor(c), row = Math.floor(r);
  const u = c - col, v = r - row;
  const i = (row * terrain.n + col) * STEP;
  const below = i + terrain.n * STEP;
  const east = terrain.h[i + STEP], south = terrain.h[below];
  const meters = u + v <= 1
    ? terrain.h[i] * (1 - u - v) + east * u + south * v
    : terrain.h[below + STEP] * (u + v - 1) + east * (1 - v) + south * (1 - u);
  return meters * exag / 1000;
}

export function pickTerrain(terrain, regional, cam, x, y, aspect, regionalHeight, exag = EXAG) {
  const eye = eyeOf(cam);
  const view = lookAt(eye, cam.target);
  const spread = Math.tan(20 * Math.PI / 180);
  const ray = [0, 1, 2].map(i => view[i * 4] * x * aspect * spread + view[i * 4 + 1] * y * spread - view[i * 4 + 2]);
  let near = cam.dist * 0.02, far = cam.dist * 3 + 800;
  const limit = regional ? 895 : terrain.half;
  for (let axis = 0; axis < 2; axis++) {
    if (Math.abs(ray[axis]) < 1e-8) {
      if (Math.abs(eye[axis]) > limit) return null;
      continue;
    }
    const a = (-limit - eye[axis]) / ray[axis], b = (limit - eye[axis]) / ray[axis];
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
  }
  const point = t => [eye[0] + ray[0] * t, eye[1] + ray[1] * t, eye[2] + ray[2] * t];
  const clearance = t => {
    const [px, py, pz] = point(t);
    const core = terrainSurfaceHeight(terrain, px, py, exag);
    const height = Number.isFinite(core) ? core : regional && Math.hypot(px, py) < 895
      ? (regionalHeight ? regionalHeight(px, py) : heightAt(regional, px, py)) * exag
      : NaN;
    return pz - height;
  };
  const step = terrain.px / (2 * Math.hypot(...ray));
  let above = null;
  for (let t = near; t <= far; t += step) {
    const distance = clearance(t);
    if (distance > 0) {
      above = t;
      continue;
    }
    if (!Number.isFinite(distance)) above = null;
    if (above === null) continue;
    let below = t;
    for (let i = 0; i < 9; i++) {
      const mid = (above + below) / 2;
      if (clearance(mid) <= 0) below = mid;
      else above = mid;
    }
    return point(below);
  }
  return null;
}

export function indexMeshSurface({ pos, idx }) {
  const size = 16, cells = new Map();
  const key = (x, y) => x + y * 4096;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const left = Math.floor(Math.min(pos[a], pos[b], pos[c]) / size);
    const right = Math.floor(Math.max(pos[a], pos[b], pos[c]) / size);
    const bottom = Math.floor(Math.min(pos[a + 1], pos[b + 1], pos[c + 1]) / size);
    const top = Math.floor(Math.max(pos[a + 1], pos[b + 1], pos[c + 1]) / size);
    for (let y = bottom; y <= top; y++) {
      for (let x = left; x <= right; x++) {
        const cell = key(x, y);
        if (!cells.has(cell)) cells.set(cell, []);
        cells.get(cell).push(i);
      }
    }
  }
  return (x, y) => {
    const candidates = cells.get(key(Math.floor(x / size), Math.floor(y / size)));
    if (!candidates) return NaN;
    for (const i of candidates) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const bx = pos[b] - pos[a], by = pos[b + 1] - pos[a + 1];
      const cx = pos[c] - pos[a], cy = pos[c + 1] - pos[a + 1];
      const dx = x - pos[a], dy = y - pos[a + 1];
      const area = bx * cy - by * cx;
      if (!area) continue;
      const u = (dx * cy - dy * cx) / area, v = (bx * dy - by * dx) / area;
      if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8) {
        return (1 - u - v) * pos[a + 2] + u * pos[b + 2] + v * pos[c + 2];
      }
    }
    return NaN;
  };
}

function mesh(t) {
  const cols = Math.floor((t.n - 1) / STEP) + 1, pos = new Float32Array(cols * cols * 3);
  for (let r = 0, k = 0; r < cols; r++) for (let c = 0; c < cols; c++, k += 3) {
    const gr = r * STEP, gc = c * STEP;
    pos[k] = -t.half + (gc + 0.5) * t.px; pos[k + 1] = t.half - (gr + 0.5) * t.px; pos[k + 2] = t.h[gr * t.n + gc] / 1000;
  }
  const idx = new Uint32Array((cols - 1) ** 2 * 6);
  for (let r = 0, k = 0; r < cols - 1; r++) for (let c = 0; c < cols - 1; c++, k += 6) {
    const a = r * cols + c, b = a + cols;
    idx.set([a, b, a + 1, a + 1, b, b + 1], k);
  }
  return { pos, idx };
}

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

// Returns null when WebGL2 is missing. colors: CSS hex tokens { amber, sun }.
export function createTerrain3D(terrain, canvas, colors) {
  const shadow = createGPUShadow(terrain);
  const gl = shadow && canvas.getContext('webgl2', { antialias: true, alpha: true });
  if (!gl) { shadow?.dispose(); return null; }
  const program = gl.createProgram();
  for (const [type, code] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, code); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(program, s);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const loc = gl.getAttribLocation(program, 'pos');
  function upload({ pos, idx }) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    return { vao, count: idx.length };
  }

  const core = upload(mesh(terrain));
  const invalid = rgb(colors.invalid), amber = rgb(colors.amber);
  const drawMarkers = createTerrainMarkers(gl, amber, invalid);
  let surroundings, regionalHeight;
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const reliefTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, reliefTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([128]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const moonMap = gl.createTexture();
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, moonMap);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([170, 170, 170, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.activeTexture(gl.TEXTURE0);
  const u = Object.fromEntries(['mvp', 'exag', 'shade', 'reliefMap', 'moonMap', 'moonSurface', 'amber', 'sun', 'sunDirection', 'halfKm', 'reliefHalf', 'expanded', 'targetCount', 'targets[0]', 'invalidTint'].map(n => [n, gl.getUniformLocation(program, n)]));
  gl.uniform1f(u.halfKm, terrain.half); gl.uniform1i(u.shade, 0);
  gl.uniform1i(u.reliefMap, 1);
  gl.uniform1i(u.moonMap, 2);
  gl.uniform3fv(u.amber, amber); gl.uniform3fv(u.sun, rgb(colors.sun));
  gl.uniform3fv(u.invalidTint, invalid);
  gl.enable(gl.DEPTH_TEST);
  let sunKey, uploadedMoonTexture;
  return {
    extend(wide) {
      if (gl.isContextLost()) return false;
      gl.useProgram(program);
      const segments = Math.floor((terrain.n - 1) / STEP);
      const half = segments * STEP * terrain.px / 2;
      const cx = half + terrain.px / 2 - terrain.half;
      const { size, pixels } = regionalRelief(wide);
      gl.activeTexture(gl.TEXTURE1);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, size, size, 0, gl.RED, gl.UNSIGNED_BYTE, pixels);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1f(u.reliefHalf, wide.half);
      const mesh = regionalMesh(terrain, wide, segments, half, cx, -cx);
      surroundings = upload(mesh);
      regionalHeight = indexMeshSurface(mesh);
      return true;
    },
    regionalHeight(x, y) { return regionalHeight?.(x, y); },
    // sun: MOON_ME unit vector; size: shadow texture pixels (the full 500 km square).
    render({ sun, size, mvp, width, height, markers, eye, moonSurface, moonTexture }) {
      if (gl.isContextLost()) return;
      gl.useProgram(program);
      const key = `${sun}:${size}`;
      if (key !== sunKey) {
        sunKey = key;
        shadow.render({ sun, view: { cx: 0, cy: 0, half: terrain.half, aspect: 1 }, size });
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, shadow.canvas);
      }
      if (moonSurface && moonTexture && moonTexture !== uploadedMoonTexture) {
        gl.activeTexture(gl.TEXTURE2);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, moonTexture);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.activeTexture(gl.TEXTURE0);
        uploadedMoonTexture = moonTexture;
      }
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(u.mvp, false, mvp);
      gl.uniform1f(u.exag, moonSurface ? 1 : EXAG);
      gl.uniform1i(u.moonSurface, Boolean(moonSurface));
      gl.uniform3fv(u.sunDirection, sun);
      gl.uniform1i(u.expanded, Boolean(surroundings));
      const targets = markers.map(({ world, bad }) => {
        const distance = Math.max(1, Math.hypot(world[0] - eye[0], world[1] - eye[1], world[2] - eye[2]));
        const depth = 0.08;
        return { world, bad, distance, depth };
      });
      gl.uniform1i(u.targetCount, targets.length);
      if (targets.length) gl.uniform4fv(u['targets[0]'], targets.flatMap(({ world, distance, bad }) => [world[0], world[1], distance, Number(Boolean(bad))]));
      gl.bindVertexArray(core.vao);
      gl.drawElements(gl.TRIANGLES, core.count, gl.UNSIGNED_INT, 0);
      if (surroundings) {
        gl.bindVertexArray(surroundings.vao);
        gl.drawElements(gl.TRIANGLES, surroundings.count, gl.UNSIGNED_INT, 0);
      }
      drawMarkers(targets, mvp, eye);
    },
    dispose() { shadow.dispose(); gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}
