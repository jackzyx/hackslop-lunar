import { viewProjection } from './terrain-3d.js';
import { SURFACE_EYE_KM } from './surface-terrain.js';

const vertex = `#version 300 es
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
uniform mat4 mvp;
out vec3 localPosition;
out vec3 surfaceNormal;
void main() {
  localPosition = position;
  surfaceNormal = normal;
  gl_Position = mvp * vec4(position, 1.0);
}`;

const fragment = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
uniform vec3 sun, earth, eye;
uniform mat4 light;
uniform sampler2DShadow shadowMap;
uniform vec2 texel;
in vec3 localPosition;
in vec3 surfaceNormal;
out vec4 color;
float hash(vec2 p) {
  vec3 q = fract(p.xyx * vec3(.1031, .1137, .1379));
  q += dot(q, q.yzx + 19.19);
  return fract((q.x + q.y) * q.z);
}
float grain(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float value = mix(mix(hash(cell), hash(cell + vec2(1, 0)), f.x),
    mix(hash(cell + vec2(0, 1)), hash(cell + vec2(1)), f.x), f.y);
  return (value - .5) * (1.0 - smoothstep(.25, 1.5, length(fwidth(p))));
}
float sunlit(vec3 n) {
  // Normal offset of ~3 texels keeps grazing-angle acne off lit ground.
  vec3 p = (light * vec4(localPosition + n * .02, 1.0)).xyz * .5 + .5;
  vec2 edge = min(p.xy, 1.0 - p.xy);
  if (min(edge.x, edge.y) <= 0.0) return 1.0;
  float sum = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++)
    sum += texture(shadowMap, vec3(p.xy + vec2(i, j) * texel, p.z));
  return mix(1.0, sum / 9.0, smoothstep(0.0, .04, edge.x)); // fade out at the strip's side edges
}
void main() {
  vec3 n = normalize(surfaceNormal);
  vec3 v = normalize(eye - localPosition);
  float mu0 = max(0.0, dot(n, sun)), mu = max(.05, dot(n, v));
  // Lunar-Lambert: regolith stays bright toward the limb instead of falling off like plaster.
  float direct = mu0 > 0.0 ? (1.4 * mu0 / (mu0 + mu) + .3 * mu0) * sunlit(n) : 0.0;
  float relief = clamp(dot(n, normalize(vec3(-.4, .25, .7))), 0.0, 1.0);
  float earthshine = earth.z > 0.0 ? .06 * (1.0 - dot(sun, earth)) * .5 * max(0.0, dot(n, earth)) : 0.0;
  vec2 p = localPosition.xy;
  float albedo = .87 + .16 * grain(p * 12.0) + .13 * grain(p * 175.0) + .20 * grain(p * 2600.0) + .24 * grain(p * 40000.0);
  vec3 c = albedo * (vec3(1.0, .972, .92) * (.06 + .13 * relief + .55 * direct) + vec3(.7, .82, 1.0) * earthshine);
  c /= 1.0 + max(c - .85, 0.0); // soft shoulder for grazing highlights
  color = vec4(c + (hash(gl_FragCoord.xy) - .5) / 255.0, 1.0);
}`;

const skyVertex = `#version 300 es
out vec2 ndc;
void main() {
  ndc = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = vec4(ndc, 1.0, 1.0);
}`;

const skyFragment = `#version 300 es
precision highp float;
uniform vec3 forward, right, up, sun, earth;
uniform vec2 scale;
uniform float pixel;
in vec2 ndc;
out vec4 color;
const float SUN_R = .004654;   // 0.2666 deg
const float EARTH_R = .016574; // 6371 km at 384,400 km
float hash(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 hash3(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1)), f.x), f.y), f.z);
}
float angle(vec3 a, vec3 b) { return 2.0 * asin(min(1.0, length(a - b) * .5)); }
vec3 stars(vec3 d) {
  vec3 sum = vec3(0);
  for (int layer = 0; layer < 3; layer++) {
    float density = float[](70.0, 150.0, 320.0)[layer];
    vec3 cell = floor(d * density) + float(layer) * 101.0;
    if (hash(cell) < float[](.94, .965, .975)[layer]) continue;
    vec3 jitter = hash3(cell);
    vec3 center = normalize(floor(d * density) + .5 + (jitter - .5) * .7);
    float size = max(pixel * .75, .00012);
    float glow = exp(-pow(angle(d, center) / size, 2.0));
    float brightness = pow(jitter.x, 3.0) * float[](1.4, .8, .45)[layer];
    sum += mix(vec3(1.0, .78, .55), vec3(.7, .82, 1.0), jitter.y) * brightness * glow;
  }
  return sum;
}
void main() {
  vec3 d = normalize(forward + right * ndc.x * scale.x + up * ndc.y * scale.y);
  float sunAngle = angle(d, sun);
  vec3 c = vec3(.004, .005, .009) + stars(d) * smoothstep(.03, .5, sunAngle);
  c += vec3(1.0, .93, .8) * (exp(-sunAngle / .012) * .5 + exp(-sunAngle / .09) * .07);
  c = mix(c, vec3(1.0, .99, .96) * 1.4, 1.0 - smoothstep(SUN_R - pixel, SUN_R + pixel, sunAngle));
  float earthAngle = angle(d, earth);
  if (earthAngle < EARTH_R + 2.0 * pixel) {
    vec3 o = (d - earth * dot(d, earth)) / sin(EARTH_R);
    float r2 = min(1.0, dot(o, o));
    vec3 n = o - earth * sqrt(1.0 - r2);
    float day = smoothstep(-.06, .12, dot(n, sun));
    float land = smoothstep(.52, .6, noise(n * 3.1 + 7.0));
    float cloud = smoothstep(.55, .75, noise(n * 6.0) * .6 + noise(n * 13.0) * .4);
    vec3 surface = mix(mix(vec3(.04, .13, .34), vec3(.26, .29, .16), land), vec3(.95), cloud);
    surface += vec3(.25, .45, 1.0) * pow(r2, 4.0) * .5; // thin atmosphere at the limb
    vec3 disc = surface * day * 1.1 + vec3(.004, .006, .012);
    c = mix(c, disc, 1.0 - smoothstep(EARTH_R - pixel, EARTH_R + pixel, earthAngle));
  }
  color = vec4(c, 1.0);
}`;

const depthFragment = `#version 300 es
void main() {}`;

const RAD = Math.PI / 180;
const FOV = 53;
const STRIP_KM = 40; // shadow map half-width across the Sun's azimuth
const ease = t => t * t * (3 - 2 * t);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(...a); return a.map(v => v / l); };

export function descentCamera({ yaw, pitch, height }, arrival, fraction) {
  const turn = (arrival.yaw - yaw + 540) % 360 - 180;
  const approach = ease(Math.max(0, (fraction - 0.18) / 0.82));
  return {
    yaw: (yaw + turn * approach + 360) % 360,
    pitch: pitch + (arrival.pitch - pitch) * approach,
    height: SURFACE_EYE_KM * (height / SURFACE_EYE_KM) ** (1 - ease(fraction)),
  };
}

// Orthographic view from the Sun over a strip along its azimuth. The Sun is within a few degrees of
// the horizon here, so the strip's light-space height stays small and one map covers the whole length.
export function sunLightMatrix(vertices, sun) {
  const z = sun, x = unit(cross([0, 0, 1], z)), y = cross(z, x);
  let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < vertices.length; i += 6) {
    const p = [vertices[i], vertices[i + 1], vertices[i + 2]];
    const lz = dot(p, z);
    z0 = Math.min(z0, lz); z1 = Math.max(z1, lz);
    if (Math.abs(dot(p, x)) > STRIP_KM) continue;
    const ly = dot(p, y);
    y0 = Math.min(y0, ly); y1 = Math.max(y1, ly);
  }
  y0 -= .1; y1 += .1; z0 -= 1; z1 += 1;
  const sy = 2 / (y1 - y0), sz = -2 / (z1 - z0);
  return [x[0] / STRIP_KM, y[0] * sy, z[0] * sz, 0, x[1] / STRIP_KM, y[1] * sy, z[1] * sz, 0,
    x[2] / STRIP_KM, y[2] * sy, z[2] * sz, 0, 0, -(y1 + y0) / (y1 - y0), 1 + 2 * z0 / (z1 - z0), 1];
}

export function createSurfaceRenderer(canvas, { vertices, indices }, sun, earth) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: true });
  if (!gl) throw new Error('WebGL 2 is unavailable');
  const programs = [], shaders = [];
  const vao = gl.createVertexArray();
  const vertexBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  const shadowSize = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
  const shadowMap = gl.createTexture();
  const shadowBuffer = gl.createFramebuffer();
  function dispose() {
    for (const shader of shaders) gl.deleteShader(shader);
    for (const program of programs) gl.deleteProgram(program);
    gl.deleteBuffer(vertexBuffer);
    gl.deleteBuffer(indexBuffer);
    gl.deleteVertexArray(vao);
    gl.deleteTexture(shadowMap);
    gl.deleteFramebuffer(shadowBuffer);
  }
  function link(vs, fs) {
    const program = gl.createProgram();
    programs.push(program);
    for (const [type, source] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    const uniforms = new Proxy({}, { get: (cache, name) => cache[name] ??= gl.getUniformLocation(program, name) });
    return { program, uniforms };
  }
  let ground, sky, depth;
  const light = sunLightMatrix(vertices, sun);
  try {
    ground = link(vertex, fragment);
    sky = link(skyVertex, skyFragment);
    depth = link(vertex, depthFragment);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    // The Sun does not move while the view is open, so the shadow map is drawn once.
    gl.bindTexture(gl.TEXTURE_2D, shadowMap);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, shadowSize, shadowSize);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowMap, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Shadow map is unavailable');
    gl.viewport(0, 0, shadowSize, shadowSize);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(depth.program);
    gl.uniformMatrix4fv(depth.uniforms.mvp, false, light);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.useProgram(ground.program);
    gl.uniform1i(ground.uniforms.shadowMap, 0);
    gl.uniformMatrix4fv(ground.uniforms.light, false, light);
    gl.uniform2f(ground.uniforms.texel, 1 / shadowSize, 1 / shadowSize);
    gl.uniform3fv(ground.uniforms.sun, sun);
    gl.uniform3fv(ground.uniforms.earth, earth);
    gl.useProgram(sky.program);
    gl.uniform3fv(sky.uniforms.sun, sun);
    gl.uniform3fv(sky.uniforms.earth, earth);
    gl.enable(gl.CULL_FACE);
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    draw({ yaw, pitch, height }) {
      const dpr = Math.min(2, devicePixelRatio);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const rows = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== rows) {
        canvas.width = width;
        canvas.height = rows;
      }
      const eye = [0, 0, height];
      const forward = [Math.sin(yaw * RAD) * Math.cos(pitch * RAD), Math.cos(yaw * RAD) * Math.cos(pitch * RAD), Math.sin(pitch * RAD)];
      const right = unit(cross(forward, [0, 0, 1])), up = cross(right, forward);
      const tanHalf = Math.tan(FOV * RAD / 2);
      gl.viewport(0, 0, width, rows);
      gl.clear(gl.DEPTH_BUFFER_BIT);

      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(sky.program);
      gl.uniform3fv(sky.uniforms.forward, forward);
      gl.uniform3fv(sky.uniforms.right, right);
      gl.uniform3fv(sky.uniforms.up, up);
      gl.uniform2f(sky.uniforms.scale, tanHalf * width / rows, tanHalf);
      gl.uniform1f(sky.uniforms.pixel, 2 * tanHalf / rows);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.enable(gl.DEPTH_TEST);
      gl.useProgram(ground.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, shadowMap);
      gl.uniform3fv(ground.uniforms.eye, eye);
      gl.uniformMatrix4fv(ground.uniforms.mvp, false, viewProjection(eye, eye.map((v, i) => v + forward[i]), width / rows, FOV, Math.max(.0002, height * .015), 650));
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
    },
    dispose,
  };
}
