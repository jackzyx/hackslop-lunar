import { createGPUShadow } from './shadow-gpu.js';

let renderer;
self.onmessage = ({ data }) => {
  try {
    if (data.terrain) {
      renderer = createGPUShadow(data.terrain, new OffscreenCanvas(1, 1));
      if (!renderer) throw new Error('Worker WebGL unavailable');
      renderer.canvas.addEventListener('webglcontextlost', () => self.postMessage({ failed: true }));
      return;
    }
    renderer.render(data);
    const { width, height: size } = renderer.canvas;
    const bitmap = renderer.canvas.transferToImageBitmap();
    self.postMessage({ bitmap, width, size, id: data.id }, [bitmap]);
  } catch {
    self.postMessage({ failed: true });
  }
};
