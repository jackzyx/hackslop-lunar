// The CPU ray marcher remains the reference and worker fallback. This shader
// performs the same terrain sampling, curvature and finite-Sun calculation in parallel.
const vertex = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const fragment = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D heights;
uniform vec3 sun;
uniform vec3 view;
uniform vec2 resolution;
uniform float terrainHalf;
uniform float pixelKm;
uniform float hmax;
out vec4 color;
const float R = 1737.4;
const float RAD = 0.017453292519943295;
bool inside(vec2 p) {
  vec2 q = (vec2(p.x, -p.y) + terrainHalf) / pixelKm - 0.5;
  return all(greaterThanEqual(q, vec2(0))) && all(lessThan(q, vec2(textureSize(heights, 0) - 1)));
}
float height(vec2 p) {
  vec2 q = (vec2(p.x, -p.y) + terrainHalf) / pixelKm - 0.5;
  ivec2 k = ivec2(floor(q)); vec2 f = fract(q);
  return mix(mix(texelFetch(heights,k,0).r, texelFetch(heights,k+ivec2(1,0),0).r,f.x),
             mix(texelFetch(heights,k+ivec2(0,1),0).r, texelFetch(heights,k+ivec2(1,1),0).r,f.x),f.y);
}
float fraction(float el, float horizon) {
  float h = (el-horizon) / (0.2665 * RAD);
  if(h >= 1.0) return 1.0; if(h <= -1.0) return 0.0;
  return 1.0 - (acos(h)-h*sqrt(1.0-h*h))/3.141592653589793;
}
void main() {
  vec2 p = view.xy + (gl_FragCoord.xy - resolution / 2.0) * (2.0 * view.z / resolution.y);
  if(!inside(p)) { color=vec4(0); return; }
  float h0=height(p), rho=length(p), u=rho/(2.0*R);
  float sc=2.0*u/(1.0+u*u), cc=(1.0-u*u)/(1.0+u*u);
  float sl=rho>0.0?p.x/rho:0.0, cl=rho>0.0?p.y/rho:1.0;
  float sinEl=sun.x*sc*cl+sun.y*sc*sl-sun.z*cc;
  float east=-sun.x*sl+sun.y*cl;
  float north=sun.x*cc*cl+sun.y*cc*sl+sun.z*sc;
  float cosEl=length(vec2(east,north));
  vec2 direction=vec2(north*sl+east*cl,north*cl-east*sl)/max(cosEl,1.e-12);
  float el=atan(sinEl,cosEl), tanHi=tan(el+0.2665*RAD), tanLo=tan(el-0.2665*RAD);
  float top=-1.e20, distance=pixelKm/2.0;
  for(int j=0;j<384;j++) {
    if(distance>=2.0*terrainHalf) break;
    vec2 q=p+direction*distance;
    if(!inside(q)) break;
    top=max(top,(height(q)-h0)/distance-distance/(2.0*R));
    if(top>tanHi) break;
    if((hmax-h0)/distance-distance/(2.0*R)<max(top,tanLo)) break;
    distance*=1.025;
  }
  float gx=0.0,gy=0.0;
  if(inside(p+vec2(pixelKm,0))&&inside(p-vec2(pixelKm,0))) gx=(height(p+vec2(pixelKm,0))-height(p-vec2(pixelKm,0)))/(2.0*pixelKm);
  if(inside(p+vec2(0,pixelKm))&&inside(p-vec2(0,pixelKm))) gy=(height(p+vec2(0,pixelKm))-height(p-vec2(0,pixelKm)))/(2.0*pixelKm);
  float norm=sqrt(1.0+gx*gx+gy*gy);
  float lam=(sinEl-cosEl*dot(vec2(gx,gy),direction))/norm;
  float amb=0.03+0.07*clamp(0.5+4.0*(gx-gy)/norm,0.0,1.0);
  float lit=fraction(el,atan(top));
  float brightness=lit*(0.35+0.65*clamp(lam/0.12,0.0,1.0))+(1.0-lit)*amb;
  color=vec4((vec3(14,14,18)+vec3(226,220,205)*brightness)/255.0,1);
}`;

export function createGPUShadow(terrain, canvas = document.createElement('canvas')) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  let program, texture;
  const shaders = [];
  try {
    program = gl.createProgram();
    for (const [type, code] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type); shaders.push(shader);
      gl.shaderSource(shader, code); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, terrain.n, terrain.n, 0, gl.RED, gl.FLOAT, Float32Array.from(terrain.h, h => h / 1000));
    const uniforms = Object.fromEntries(['sun','view','resolution','terrainHalf','pixelKm','hmax'].map(name => [name, gl.getUniformLocation(program,name)]));
    gl.uniform1f(uniforms.terrainHalf, terrain.half); gl.uniform1f(uniforms.pixelKm, terrain.px); gl.uniform1f(uniforms.hmax, terrain.hmax);
    if (canvas.dataset) canvas.dataset.renderer = 'webgl2';
    return { canvas,
      render({ sun, view, size, id }) {
        if (gl.isContextLost()) throw new Error('Shadow GPU context lost');
        const width = Math.max(1, Math.round(size * (view.aspect ?? 1)));
        if (canvas.width !== width || canvas.height !== size) { canvas.width = width; canvas.height = size; }
        gl.viewport(0,0,width,size); gl.useProgram(program);
        gl.uniform3fv(uniforms.sun,sun); gl.uniform3f(uniforms.view,view.cx,view.cy,view.half); gl.uniform2f(uniforms.resolution,width,size);
        gl.drawArrays(gl.TRIANGLES,0,3); if (canvas.dataset) canvas.dataset.frame = String(id);
      },
      dispose() { gl.deleteTexture(texture); gl.deleteProgram(program); shaders.forEach(s => gl.deleteShader(s)); gl.getExtension('WEBGL_lose_context')?.loseContext(); },
    };
  } catch {
    if (texture) gl.deleteTexture(texture);
    if (program) gl.deleteProgram(program);
    shaders.forEach(s => gl.deleteShader(s));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
}
