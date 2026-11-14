import { paint, shadeView } from './shadow.js';
import { spherePixels } from './intro-pixels.js';

// Only one scene is retained. Replaying the same landing reuses the prepared
// images, while a new landing cancels obsolete preparation work.
let cached;
export function stopIntroAssetPreparation() {
  if (!cached) return;
  cached.onProgress = undefined;
  if (cached.assets?.complete) return;
  const entry = cached;
  cached = undefined;
  entry.worker?.terminate();
  entry.resolve(null);
}

export function prepareIntroAssets({ terrain, sun, quality, textureUrl, closeView }, onProgress) {
  const key = `${sun.join(',')}/${quality.sphere}/${quality.terrain}/${JSON.stringify(closeView)}`;
  if (cached?.key === key && cached.terrain === terrain) {
    cached.onProgress = onProgress;
    if (cached.assets) onProgress?.(cached.assets);
    return cached.promise;
  }
  stopIntroAssetPreparation();
  const entry = { terrain, key, onProgress }; cached = entry;
  const publish = data => {
    entry.assets = { ...entry.assets, ...data };
    entry.onProgress?.(entry.assets);
    return entry.assets;
  };
  entry.promise = new Promise(resolve => {
    entry.resolve = resolve;
    const fallback = async () => {
      if (cached !== entry) return;
      // Worker-disabled browsers still yield between small terrain tiles.
      const moonN = 512, landN = 640, tile = 32;
      const moon = spherePixels(sun, moonN, null);
      publish({ moon, moonN, stage: 'moon' });
      const land = terrain ? new Uint8ClampedArray(landN * landN * 4) : null;
      if (land) for (let y = 0; y < landN; y += tile) for (let x = 0; x < landN; x += tile) {
        if (cached !== entry) return;
        const half = 250 * tile / landN;
        const pixels = new Uint8ClampedArray(tile * tile * 4);
        paint(shadeView(terrain, sun, { cx: -250 + (x + tile / 2) * 500 / landN, cy: 250 - (y + tile / 2) * 500 / landN, half }, tile), pixels);
        for (let row = 0; row < tile; row++) land.set(pixels.subarray(row * tile * 4, (row + 1) * tile * 4), ((y + row) * landN + x) * 4);
        await new Promise(done => setTimeout(done, 0));
      }
      let close;
      if (terrain && closeView) {
        close = new Uint8ClampedArray(landN * landN * 4);
        for (let y = 0; y < landN; y += tile) for (let x = 0; x < landN; x += tile) {
          if (cached !== entry) return;
          const half = closeView.half * tile / landN;
          const pixels = new Uint8ClampedArray(tile * tile * 4);
          paint(shadeView(terrain, sun, { cx: closeView.cx - closeView.half + (x + tile / 2) * 2 * closeView.half / landN, cy: closeView.cy + closeView.half - (y + tile / 2) * 2 * closeView.half / landN, half }, tile), pixels);
          for (let row = 0; row < tile; row++) close.set(pixels.subarray(row * tile * 4, (row + 1) * tile * 4), ((y + row) * landN + x) * 4);
          await new Promise(done => setTimeout(done, 0));
        }
      }
      if (cached === entry) resolve(publish({ moon, land, close, closeN: landN, moonN, landN, stage: 'complete', complete: true }));
    };
    try {
      const worker = new Worker(new URL('./intro.worker.js', import.meta.url), { type: 'module' });
      entry.worker = worker;
      worker.onmessage = ({ data }) => {
        if (cached !== entry) return;
        const assets = publish(data);
        if (data.complete) { worker.terminate(); entry.worker = null; resolve(assets); }
      };
      worker.onerror = event => { event.preventDefault(); worker.terminate(); entry.worker = null; fallback(); };
      worker.postMessage({ terrain, sun, quality, textureUrl, closeView });
    } catch { fallback(); }
  });
  return entry.promise;
}
