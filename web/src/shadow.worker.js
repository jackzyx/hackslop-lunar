import { shadeView, paint } from './shadow.js';
let terrain;
self.onmessage = ({ data }) => {
  if (data.terrain) { terrain = data.terrain; return; }
  const { sun, view, size, id } = data;
  const pixels = new Uint8ClampedArray(size * size * 4);
  paint(shadeView(terrain, sun, view, size), pixels);
  self.postMessage({ pixels, size, id }, [pixels.buffer]);
};
