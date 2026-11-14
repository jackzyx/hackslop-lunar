import { spherePixels } from './intro-pixels.js';
import { paint, shadeView } from './terrain/shadow.js';
import { createGPUShadow } from './terrain/shadow-gpu.js';

self.onmessage = async ({ data: { terrain, sun, quality, textureUrl, closeView } }) => {
  const previewMoon = spherePixels(sun, 256, null);
  self.postMessage({ moon: previewMoon, moonN: 256, stage: 'moon' }, [previewMoon.buffer]);
  // Start the texture request immediately, but do not make terrain wait for it.
  const textureTask = loadTexture(textureUrl);
  if (terrain) {
    const landN = Math.min(512, quality.terrain), land = new Uint8ClampedArray(landN * landN * 4);
    paint(shadeView(terrain, sun, { cx: 0, cy: 0, half: 250 }, landN), land);
    self.postMessage({ land, landN, stage: 'preview' }, [land.buffer]);
  }
  // Render the landing region directly, before waiting for the globe texture.
  // Enlarging a crop of the 500 km overview cannot retain this detail.
  if (terrain && closeView) {
    let closeN = 768, close;
    let gpu;
    try {
      gpu = createGPUShadow(terrain, new OffscreenCanvas(closeN, closeN));
      if (!gpu) throw new Error('WebGL unavailable');
      gpu.render({ sun, view: closeView, size: closeN, id: 0 });
      const gl = gpu.canvas.getContext('webgl2'), pixels = new Uint8Array(closeN * closeN * 4);
      gl.readPixels(0, 0, closeN, closeN, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      if (gl.getError() !== gl.NO_ERROR || gl.isContextLost()) throw new Error('Terrain readback failed');
      close = new Uint8ClampedArray(pixels.length);
      for (let y = 0; y < closeN; y++) close.set(pixels.subarray((closeN - 1 - y) * closeN * 4, (closeN - y) * closeN * 4), y * closeN * 4);
    } catch {
      closeN = 512;
      close = new Uint8ClampedArray(closeN * closeN * 4);
      paint(shadeView(terrain, sun, closeView, closeN), close);
    } finally { gpu?.dispose(); }
    self.postMessage({ close, closeN, stage: 'close' }, [close.buffer]);
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
