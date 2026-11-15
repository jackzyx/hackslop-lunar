const vertexSource = `#version 300 es
layout(location = 0) in vec4 point;
uniform mat4 mvp;
out float strength;
void main() {
  strength = point.w;
  gl_Position = mvp * vec4(point.xyz, 1.0);
}`;

const fragmentSource = `#version 300 es
precision highp float;
uniform vec3 tint;
in float strength;
out vec4 color;
void main() {
  vec3 light = mix(tint, vec3(1.0, 0.94, 0.82), pow(strength, 4.0) * 0.85);
  color = vec4(light * strength, strength);
}`;

export function markerVertices(world, eye, distance, depth) {
  const [x, y, z] = world;
  const vertices = [];
  const quad = (a, b, c, d) => vertices.push(...a, ...b, ...c, ...c, ...b, ...d);
  const flatDistance = Math.hypot(eye[0] - x, eye[1] - y);
  const right = flatDistance > 0.001 ? [(eye[1] - y) / flatDistance, (x - eye[0]) / flatDistance] : [1, 0];
  const beamHeight = distance * 0.95;
  const profile = [[-1, 0], [-0.32, 0.2], [-0.1, 0.84], [0, 1], [0.1, 0.84], [0.32, 0.2], [1, 0]];
  const levels = [[0, 1], [0.4, 0.8], [0.74, 0.32], [1, 0]];
  const beamPoint = ([offset, opacity], [height, fade]) => [
    x + right[0] * offset * distance * 0.009,
    y + right[1] * offset * distance * 0.009,
    z - depth + (beamHeight + depth) * height,
    opacity * fade,
  ];
  for (let i = 1; i < profile.length; i++) {
    for (let j = 1; j < levels.length; j++) {
      quad(beamPoint(profile[i - 1], levels[j - 1]), beamPoint(profile[i], levels[j - 1]),
        beamPoint(profile[i - 1], levels[j]), beamPoint(profile[i], levels[j]));
    }
  }
  return new Float32Array(vertices);
}

export function createTerrainMarkers(gl, amber, invalid) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const projection = gl.getUniformLocation(program, "mvp"), tint = gl.getUniformLocation(program, "tint");
  const vao = gl.createVertexArray(), buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);

  return (markers, mvp, eye) => {
    if (!markers.length) return;
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.uniformMatrix4fv(projection, false, mvp);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const { world, bad, distance, depth } of markers) {
      const vertices = markerVertices(world, eye, distance, depth);
      gl.uniform3fv(tint, bad ? invalid : amber);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 4);
    }
    gl.disable(gl.BLEND);
    gl.depthMask(true);
  };
}
