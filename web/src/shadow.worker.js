import { shadeView, paint } from './shadow.js';
let terrain;
self.onmessage = ({ data }) => {
  if (data.terrain) { terrain = data.terrain; return; }
  const { sun, view, size, id } = data;
  const width = Math.max(1, Math.round(size * (view.aspect ?? 1)));
  const pixels = new Uint8ClampedArray(width * size * 4);
  paint(shadeView(terrain, sun, view, width, size), pixels);
  self.postMessage({ pixels, size, width, id }, [pixels.buffer]);
};
