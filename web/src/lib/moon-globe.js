const tilt = 24 * Math.PI / 180;
const tiltCos = Math.cos(tilt);
const tiltSin = Math.sin(tilt);
const lunarRadiusKm = 1737.4;
const reliefStrength = 3;

function sampleHeight(data, width, height, x, y) {
  const left = Math.floor(x);
  const boundedY = Math.max(0, Math.min(height - 1, y));
  const top = Math.floor(boundedY);
  const nextRow = Math.min(top + 1, height - 1);
  const west = (left + width) % width;
  const east = (west + 1) % width;
  const blendX = x - left;
  const blendY = boundedY - top;
  const upper = data[(top * width + west) * 4] * (1 - blendX) + data[(top * width + east) * 4] * blendX;
  const lower = data[(nextRow * width + west) * 4] * (1 - blendX) + data[(nextRow * width + east) * 4] * blendX;
  return upper + (lower - upper) * blendY;
}

export function createMoonRenderer(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return null;

  const size = canvas.width;
  const image = context.createImageData(size, size);
  const sphereZ = new Float32Array(size * size);
  const normals = new Float32Array(size * size * 3);
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
      sphereZ[pixel] = z;
      normals[pixel * 3] = x;
      normals[pixel * 3 + 1] = y;
      normals[pixel * 3 + 2] = z;
      texCoords[pixel * 2] = longitude / (2 * Math.PI) + 0.5;
      texCoords[pixel * 2 + 1] = 0.5 - latitude / Math.PI;
      image.data[pixel * 4 + 3] = 255 * Math.min(1, coverage);
      first = Math.min(first, col);
      last = col + 1;
    }
    rowBounds.push([first, last]);
  }

  function setElevation(texture) {
    const map = document.createElement('canvas');
    const width = map.width = texture.naturalWidth;
    const height = map.height = texture.naturalHeight;
    const mapContext = map.getContext('2d', { willReadFrequently: true });
    if (!mapContext || width < 2 || height < 2) return;

    mapContext.drawImage(texture, 0, 0);
    const { data } = mapContext.getImageData(0, 0, width, height);
    const kmPerGrayLevel = 20 / 255;
    const eastScale = reliefStrength * kmPerGrayLevel / (2 * lunarRadiusKm * 2 * Math.PI / width);
    const northScale = reliefStrength * kmPerGrayLevel / (2 * lunarRadiusKm * Math.PI / height);
    for (let row = 0; row < size; row++) {
      const [first, last] = rowBounds[row];
      const y = -axes[row];
      for (let col = first; col < last; col++) {
        const pixel = row * size + col;
        const u = texCoords[pixel * 2];
        const v = texCoords[pixel * 2 + 1];
        const longitude = (u - 0.5) * 2 * Math.PI;
        const latitude = (0.5 - v) * Math.PI;
        const cosLat = Math.cos(latitude);
        const sinLat = Math.sin(latitude);
        const cosLon = Math.cos(longitude);
        const sinLon = Math.sin(longitude);
        const sampleX = u * width - 0.5;
        const sampleY = v * height - 0.5;
        const east = (sampleHeight(data, width, height, sampleX + 1, sampleY)
          - sampleHeight(data, width, height, sampleX - 1, sampleY)) * eastScale / Math.max(0.1, cosLat);
        const north = (sampleHeight(data, width, height, sampleX, sampleY - 1)
          - sampleHeight(data, width, height, sampleX, sampleY + 1)) * northScale;
        const z = sphereZ[pixel];
        const strength = Math.min(1, z * 8, cosLat * 10);
        const nx = axes[col] + strength * (-east * cosLon + north * sinLat * sinLon);
        const ny = y + strength * (east * sinLon * tiltSin - north * (cosLat * tiltCos + sinLat * cosLon * tiltSin));
        const nz = z + strength * (east * sinLon * tiltCos - north * (cosLat * tiltSin - sinLat * cosLon * tiltCos));
        const length = Math.hypot(nx, ny, nz);
        normals[pixel * 3] = nx / length;
        normals[pixel * 3 + 1] = ny / length;
        normals[pixel * 3 + 2] = nz / length;
      }
    }
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
        const sphereLight = axes[col] * lightX + rowLight + sphereZ[pixel] * lightZ;
        const diffuse = normals[pixel * 3] * lightX + normals[pixel * 3 + 1] * lightY + normals[pixel * 3 + 2] * lightZ;
        const horizon = Math.max(0, Math.min(1, 1 + sphereLight * 8));
        const brightness = 0.085 + 1.13 * Math.sqrt(Math.max(0, diffuse)) * horizon;
        data[pixel * 4] = albedo[pixel * 3] * brightness;
        data[pixel * 4 + 1] = albedo[pixel * 3 + 1] * brightness;
        data[pixel * 4 + 2] = albedo[pixel * 3 + 2] * brightness;
      }
    }
    context.putImageData(image, 0, 0);
  }

  return { render, setTexture, setElevation };
}
