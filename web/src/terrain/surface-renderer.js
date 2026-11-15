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
uniform vec3 sun;
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
void main() {
  vec3 n = normalize(surfaceNormal);
  float direct = max(0.0, dot(n, sun));
  float relief = clamp(dot(n, normalize(vec3(-.4, .25, .7))), 0.0, 1.0);
  float lit = .075 + .16 * relief + .56 * sqrt(direct);
  vec2 p = localPosition.xy;
  float albedo = .87 + .16 * grain(p * 12.0) + .13 * grain(p * 175.0) + .20 * grain(p * 2600.0) + .24 * grain(p * 40000.0);
  color = vec4(vec3(1.0, .972, .92) * (albedo * lit), 1.0);
}`;

const RAD = Math.PI / 180;
const ease = t => t * t * (3 - 2 * t);

export function descentCamera({ yaw, pitch, height }, arrival, fraction) {
  const turn = (arrival.yaw - yaw + 540) % 360 - 180;
  const approach = ease(Math.max(0, (fraction - 0.18) / 0.82));
  return {
    yaw: (yaw + turn * approach + 360) % 360,
    pitch: pitch + (arrival.pitch - pitch) * approach,
    height: SURFACE_EYE_KM * (height / SURFACE_EYE_KM) ** (1 - ease(fraction)),
  };
}

export function createSurfaceRenderer(canvas, { vertices, indices }) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: true });
  if (!gl) throw new Error('WebGL 2 is unavailable');
  const program = gl.createProgram();
  const shaders = [];
  const vao = gl.createVertexArray();
  const vertexBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  function dispose() {
    for (const shader of shaders) gl.deleteShader(shader);
    gl.deleteBuffer(vertexBuffer);
    gl.deleteBuffer(indexBuffer);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
  }
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(.004, .005, .009, 1);
  } catch (error) {
    dispose();
    throw error;
  }
  const mvp = gl.getUniformLocation(program, 'mvp');
  const solar = gl.getUniformLocation(program, 'sun');
  return {
    draw({ yaw, pitch, height }, sun) {
      const dpr = Math.min(2, devicePixelRatio);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const rows = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== rows) {
        canvas.width = width;
        canvas.height = rows;
      }
      const eye = [0, 0, height];
      const look = [Math.sin(yaw * RAD) * Math.cos(pitch * RAD), Math.cos(yaw * RAD) * Math.cos(pitch * RAD), height + Math.sin(pitch * RAD)];
      gl.viewport(0, 0, width, rows);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(mvp, false, viewProjection(eye, look, width / rows, 53, Math.max(.0002, height * .015), 650));
      gl.uniform3fv(solar, sun);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
    },
    dispose,
  };
}
