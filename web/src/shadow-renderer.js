import { createGPUShadow } from './shadow-gpu.js';

export function createShadowRenderer(terrain, mount) {
  let renderer = createGPUShadow(terrain), latest, frame = 0, worker, pending, busy = false, disposed = false;
  function fallback() {
    renderer?.dispose();
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    canvas.dataset.renderer = 'worker';
    worker = new Worker(new URL('./shadow.worker.js', import.meta.url), { type: 'module' });
    worker.postMessage({ terrain });
    worker.onmessage = ({ data: { pixels, size, id } }) => {
      if (disposed) return;
      canvas.width = size; canvas.height = size;
      ctx.putImageData(new ImageData(pixels,size,size),0,0); canvas.dataset.frame = String(id);
      busy = false;
      if (pending) { const request = pending; pending = null; renderer.render(request); }
    };
    renderer = { canvas,
      render(request) {
        // One active job plus the newest request. Never build up a queue of old dates.
        if (busy) { pending = request; return; }
        busy = true; worker.postMessage({ ...request, size: request.interacting ? 144 : 360 });
      },
      dispose() { worker.terminate(); },
    };
    mount.replaceChildren(canvas);
  }
  if (renderer) mount.replaceChildren(renderer.canvas); else fallback();
  function draw() {
    frame = 0;
    try { renderer.render(latest); }
    catch { fallback(); renderer.render(latest); }
  }
  return {
    request(value) { latest = value; if (!frame) frame = requestAnimationFrame(draw); },
    dispose() { disposed = true; cancelAnimationFrame(frame); renderer.dispose(); mount.replaceChildren(); },
  };
}
