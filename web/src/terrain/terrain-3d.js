// 3D view of the same LOLA 500 m grid: a heightfield mesh textured with the GPU shadow map
// (shadow-gpu.js) for the landing instant, drawn as amber contours over sunlit ground.
// World axes: x, y in map km (+y toward lon 0), z = height km x EXAG.
import { createGPUShadow } from './shadow-gpu.js';

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
uniform vec3 amber, sun;
uniform float halfKm;
out vec4 color;
float line(float f) { return 1.0 - min(abs(fract(f - 0.5) - 0.5) / max(fwidth(f), 1e-5), 1.0); }
void main() {
  vec4 s = texture(shade, vec2(v.x + halfKm, halfKm - v.y) / (2.0 * halfKm));
  if (s.a < 0.5) discard;
  float b = clamp((s.r * 255.0 - 14.0) / 226.0, 0.0, 1.0); // undo shadow-gpu's paint ramp
  vec3 c = mix(amber * 0.04, mix(amber, sun, b * b), b);
  c += amber * (0.3 * line(v.z / ${CONTOUR_KM.toFixed(1)}) + 0.55 * line(v.z / ${MAJOR_KM.toFixed(1)}));
  c += amber * 0.1 * max(line(v.x / ${GRID_KM.toFixed(1)}), line(v.y / ${GRID_KM.toFixed(1)}));
  c *= 0.84 + 0.16 * step(1.0, mod(gl_FragCoord.y, 3.0)); // scanlines
  color = vec4(c, 1.0);
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
export function cameraMatrix({ target, yaw, pitch, dist }, aspect) {
  const y = yaw * Math.PI / 180, p = pitch * Math.PI / 180;
  const eye = [target[0] + dist * Math.cos(p) * Math.sin(y), target[1] + dist * Math.cos(p) * Math.cos(y), target[2] + dist * Math.sin(p)];
  return mul(perspective(40 * Math.PI / 180, aspect, dist * 0.02, dist * 3 + 800), lookAt(eye, target));
}

// World point -> CSS pixels in a w x h viewport; null when behind the camera.
export function project(m, [x, y, z], w, h) {
  const c = [0, 1, 3].map(r => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r]);
  if (c[2] <= 0) return null;
  return [(c[0] / c[2] + 1) / 2 * w, (1 - c[1] / c[2]) / 2 * h];
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
  const { pos, idx } = mesh(terrain);
  gl.bindVertexArray(gl.createVertexArray());
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'pos');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const u = Object.fromEntries(['mvp', 'exag', 'shade', 'amber', 'sun', 'halfKm'].map(n => [n, gl.getUniformLocation(program, n)]));
  gl.uniform1f(u.exag, EXAG); gl.uniform1f(u.halfKm, terrain.half); gl.uniform1i(u.shade, 0);
  gl.uniform3fv(u.amber, rgb(colors.amber)); gl.uniform3fv(u.sun, rgb(colors.sun));
  gl.enable(gl.DEPTH_TEST);
  let sunKey;
  return {
    // sun: MOON_ME unit vector; size: shadow texture pixels (the full 500 km square).
    render({ sun, size, mvp, width, height }) {
      if (gl.isContextLost()) return;
      const key = `${sun}:${size}`;
      if (key !== sunKey) {
        sunKey = key;
        shadow.render({ sun, view: { cx: 0, cy: 0, half: terrain.half, aspect: 1 }, size });
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, shadow.canvas);
      }
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(u.mvp, false, mvp);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0);
    },
    dispose() { shadow.dispose(); gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}
