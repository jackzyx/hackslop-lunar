import { spherePixels } from './intro-pixels.js';
import { paint, shadeView, terrainFrom } from '../terrain/shadow.js';
import { createGPUShadow } from '../terrain/shadow-gpu.js';
import { APPROACH_TERRAIN } from '../terrain/regional-terrain.js';

self.onmessage = async ({ data: { terrain, sun, quality, textureUrl, approachUrl, closeView } }) => {
  const previewMoon = spherePixels(sun, 256, null);
  self.postMessage({ moon: previewMoon, moonN: 256, stage: 'moon' }, [previewMoon.buffer]);
  // Start the texture request immediately, but do not make terrain wait for it.
  const textureTask = loadTexture(textureUrl);
  const approachTask = loadApproachTerrain(approachUrl);
  if (terrain) {
    const landN = Math.min(512, quality.terrain), land = new Uint8ClampedArray(landN * landN * 4);
    paint(shadeView(terrain, sun, { cx: 0, cy: 0, half: 250 }, landN), land);
    self.postMessage({ land, landN, stage: 'preview' }, [land.buffer]);
  }
  // Render the landing region directly, before waiting for the globe texture.
  // Enlarging a crop of the 500 km overview cannot retain this detail.
  if (terrain && closeView) {
    const { pixels: close, size: closeN } = renderTerrain(terrain, sun, closeView, quality.closeTerrain ?? 768);
    self.postMessage({ close, closeN, stage: 'close' }, [close.buffer]);
  }
  const approach = await approachTask;
  if (approach) {
    const wideView = { cx: 0, cy: 0, half: 895 };
    const { pixels: wide, size: wideN } = renderTerrain(approach, sun, wideView, 1280);
    self.postMessage({ wide, wideN, wideHalf: wideView.half, stage: 'regional' }, [wide.buffer]);
  }
  const texture = await textureTask;
  // The localized tile carries close-up detail; do not spend another large
  // CPU render on the overview that is already hidden underneath it.
  const moonN = quality.sphere, landN = closeView ? 512 : quality.terrain;
  const moon = spherePixels(sun, moonN, texture);
  self.postMessage({ moon, moonN, stage: 'textured' }, [moon.buffer]);
  const land = terrain ? new Uint8ClampedArray(landN * landN * 4) : null;
  if (land) paint(shadeView(terrain, sun, { cx: 0, cy: 0, half: 250 }, landN), land);
  self.postMessage({ land, landN, stage: 'complete', complete: true }, land ? [land.buffer] : []);
};

function renderTerrain(terrain, sun, view, size) {
  let gpu;
  try {
    gpu = createGPUShadow(terrain, new OffscreenCanvas(size, size));
    if (!gpu) throw new Error('WebGL unavailable');
    gpu.render({ sun, view, size, id: 0 });
    const gl = gpu.canvas.getContext('webgl2'), source = new Uint8Array(size * size * 4);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (gl.getError() !== gl.NO_ERROR || gl.isContextLost()) throw new Error('Terrain readback failed');
    const pixels = new Uint8ClampedArray(source.length);
    for (let y = 0; y < size; y++) pixels.set(source.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    return { pixels, size };
  } catch {
    size = 512;
    const pixels = new Uint8ClampedArray(size * size * 4);
    paint(shadeView(terrain, sun, view, size), pixels);
    return { pixels, size };
  } finally { gpu?.dispose(); }
}

async function loadApproachTerrain(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (response.ok) return terrainFrom(await response.arrayBuffer(), APPROACH_TERRAIN);
  } catch { /* Retain the existing overview if the optional wide terrain fails. */ }
  return null;
}

async function loadTexture(textureUrl) {
  let texture = null;
  try {
    const response = await fetch(textureUrl, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const image = await createImageBitmap(await response.blob());
      const canvas = new OffscreenCanvas(image.width, image.height), ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0); image.close();
      texture = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  } catch { /* A missing visual texture does not prevent the intro. */ }
  return texture;
}
