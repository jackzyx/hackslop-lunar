import { spherePixels } from './intro-pixels.js';
import { paint, shadeView } from './shadow.js';

self.onmessage = async ({ data: { terrain, sun, quality, textureUrl } }) => {
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
  const moonN = quality.sphere, landN = quality.terrain;
  const moon = spherePixels(sun, moonN, texture);
  const land = terrain ? new Uint8ClampedArray(landN * landN * 4) : null;
  if (land) paint(shadeView(terrain, sun, { cx: 0, cy: 0, half: 250 }, landN), land);
  const transfers = land ? [moon.buffer, land.buffer] : [moon.buffer];
  self.postMessage({ moon, land, moonN, landN }, transfers);
};
