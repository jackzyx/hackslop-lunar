const tilt = 24 * Math.PI / 180;
const tiltCos = Math.cos(tilt);
const tiltSin = Math.sin(tilt);

export function createMoonRenderer(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return null;

  const size = canvas.width;
  const image = context.createImageData(size, size);
  const normals = new Float32Array(size * size);
  const texCoords = new Float32Array(size * size * 2);
  const albedo = new Uint8ClampedArray(size * size * 3).fill(155);
  const axes = Float32Array.from({ length: size }, (_, i) => (2 * i + 1) / size - 1);
  const rowBounds = [];

  for (let row = 0; row < size; row++) {
    const y = -axes[row];
    let first = size;
    let last = 0;
    for (let col = 0; col < size; col++) {
      const x = axes[col];
      const radiusSquared = x * x + y * y;
      const coverage = (1 - Math.sqrt(radiusSquared)) * size / 2 + 0.5;
      if (coverage <= 0) continue;

      const pixel = row * size + col;
      const z = Math.sqrt(Math.max(0, 1 - radiusSquared));
      const latitude = Math.asin(y * tiltCos - z * tiltSin);
      const longitude = Math.atan2(x, y * tiltSin + z * tiltCos);
      normals[pixel] = z;
      texCoords[pixel * 2] = longitude / (2 * Math.PI) + 0.5;
      texCoords[pixel * 2 + 1] = 0.5 - latitude / Math.PI;
      image.data[pixel * 4 + 3] = 255 * Math.min(1, coverage);
      first = Math.min(first, col);
      last = col + 1;
    }
    rowBounds.push([first, last]);
  }

  function setTexture(texture) {
    const map = document.createElement('canvas');
    map.width = 2048;
    map.height = 1024;
    const mapContext = map.getContext('2d', { willReadFrequently: true });
    if (!mapContext) return;

    mapContext.drawImage(texture, 0, 0, map.width, map.height);
    const { data } = mapContext.getImageData(0, 0, map.width, map.height);
    for (let row = 0; row < size; row++) {
      const [first, last] = rowBounds[row];
      for (let col = first; col < last; col++) {
        const pixel = row * size + col;
        const x = Math.floor(texCoords[pixel * 2] * map.width) % map.width;
        const y = Math.min(map.height - 1, Math.floor(texCoords[pixel * 2 + 1] * map.height));
        const source = (y * map.width + x) * 4;
        albedo[pixel * 3] = data[source];
        albedo[pixel * 3 + 1] = data[source + 1];
        albedo[pixel * 3 + 2] = data[source + 2];
      }
    }
  }

  function render(x, y) {
    const lx = 2 * x - 1;
    const ly = 1 - 2 * y;
    const lz = 0.72 - Math.hypot(lx, ly);
    const length = Math.hypot(lx, ly, lz);
    const [lightX, lightY, lightZ] = [lx / length, ly / length, lz / length];
    const { data } = image;

    for (let row = 0; row < size; row++) {
      const [first, last] = rowBounds[row];
      const rowLight = -axes[row] * lightY;
      for (let col = first; col < last; col++) {
        const pixel = row * size + col;
        const diffuse = axes[col] * lightX + rowLight + normals[pixel] * lightZ;
        const brightness = 0.085 + 1.13 * Math.sqrt(Math.max(0, diffuse));
        data[pixel * 4] = albedo[pixel * 3] * brightness;
        data[pixel * 4 + 1] = albedo[pixel * 3 + 1] * brightness;
        data[pixel * 4 + 2] = albedo[pixel * 3 + 2] * brightness;
      }
    }
    context.putImageData(image, 0, 0);
  }

  return { render, setTexture };
}
