import { spherePixels } from './intro-pixels.js';
import { paint, shadeView } from './shadow.js';

self.onmessage = async ({ data: { terrain, sun, quality, textureUrl } }) => {
  const previewMoon = spherePixels(sun, 256, null);
  self.postMessage({ moon: previewMoon, moonN: 256, stage: 'moon' }, [previewMoon.buffer]);
  // Start the texture request immediately, but do not make terrain wait for it.
  const textureTask = loadTexture(textureUrl);
  if (terrain) {
    const landN = Math.min(512, quality.terrain), land = new Uint8ClampedArray(landN * landN * 4);
    paint(shadeView(terrain, sun, { cx: 0, cy: 0, half: 250 }, landN), land);
    self.postMessage({ land, landN, stage: 'preview' }, [land.buffer]);
  }
  const texture = await textureTask;
  const moonN = quality.sphere, landN = quality.terrain;
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
