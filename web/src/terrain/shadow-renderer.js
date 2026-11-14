import { createGPUShadow } from './shadow-gpu.js';

let preparedGPU;
export function prepareShadowRenderer(terrain) {
  if (preparedGPU || typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined') return;
  try {
    const worker = new Worker(new URL('./shadow-gpu.worker.js', import.meta.url), { type: 'module' });
    const entry = { terrain, worker };
    preparedGPU = entry;
    const fail = event => {
      event?.preventDefault();
      if (preparedGPU === entry) { worker.terminate(); preparedGPU = undefined; }
    };
    worker.onerror = fail;
    worker.onmessage = ({ data }) => { if (data.failed) fail(); };
    worker.postMessage({ terrain });
  } catch { /* The renderer will use its normal fallback on mount. */ }
}

function createWorkerGPU(terrain, mount, onPaint, onFailure) {
  if (typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('bitmaprenderer');
  if (!context) return null;
  let worker;
  const prepared = preparedGPU?.terrain === terrain ? preparedGPU : null;
  if (prepared) { worker = prepared.worker; preparedGPU = undefined; }
  try { worker ??= new Worker(new URL('./shadow-gpu.worker.js', import.meta.url), { type: 'module' }); }
  catch { return null; }
  let active, pending, disposed = false;
  const fail = event => {
    event?.preventDefault();
    if (!disposed) onFailure();
  };
  const renderer = {
    canvas, asynchronous: true,
    render(request) {
      if (active) { pending = request; return; }
      active = request;
      worker.postMessage(request);
    },
    dispose() { disposed = true; worker.terminate(); canvas.removeEventListener('webglcontextlost', fail); },
  };
  canvas.dataset.renderer = 'webgl2';
  canvas.dataset.offscreen = 'true';
  canvas.addEventListener('webglcontextlost', fail);
  worker.onerror = fail;
  worker.onmessage = ({ data }) => {
    if (disposed) { data.bitmap?.close(); return; }
    if (data.failed) { fail(); return; }
    canvas.width = data.width; canvas.height = data.size;
    context.transferFromImageBitmap(data.bitmap);
    canvas.dataset.frame = String(data.id);
    onPaint(active);
    active = null;
    if (pending) { const request = pending; pending = null; renderer.render(request); }
  };
  if (!prepared) worker.postMessage({ terrain });
  mount.replaceChildren(canvas);
  return renderer;
}

export function createShadowRenderer(terrain, mount, onPaint) {
  let renderer, latest, frame = 0, worker, pending, active, disposed = false;
  function fallback() {
    renderer?.dispose();
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    canvas.dataset.renderer = 'worker';
    try {
      worker = new Worker(new URL('./shadow.worker.js', import.meta.url), { type: 'module' });
      worker.onerror = () => { canvas.dataset.renderError = 'true'; };
      worker.postMessage({ terrain });
    } catch {
      canvas.dataset.renderError = 'true';
    }
    if (worker) worker.onmessage = ({ data: { pixels, size, width, id } }) => {
      if (disposed) return;
      canvas.width = width; canvas.height = size;
      ctx.putImageData(new ImageData(pixels,width,size),0,0); canvas.dataset.frame = String(id);
      onPaint(active);
      active = null;
      if (pending) { const request = pending; pending = null; renderer.render(request); }
    };
    renderer = { canvas,
      asynchronous: true,
      render(request) {
        // One active job plus the newest request. Never build up a queue of old dates.
        if (canvas.dataset.renderError) return;
        if (active) { pending = request; return; }
        active = request;
        worker.postMessage({ ...request, size: request.interacting ? 144 : 360 });
      },
      dispose() { worker?.terminate(); },
    };
    mount.replaceChildren(canvas);
  }
  renderer = createWorkerGPU(terrain, mount, onPaint, () => {
    fallback();
    if (latest) renderer.render(latest);
  }) ?? createGPUShadow(terrain);
  if (renderer) mount.replaceChildren(renderer.canvas); else fallback();
  function draw() {
    frame = 0;
    try {
      renderer.render(latest);
      if (!renderer.asynchronous) onPaint(latest);
    }
    catch { fallback(); renderer.render(latest); }
  }
  return {
    request(value) { latest = value; if (!frame) frame = requestAnimationFrame(draw); },
    dispose() { disposed = true; cancelAnimationFrame(frame); renderer.dispose(); mount.replaceChildren(); },
  };
}
