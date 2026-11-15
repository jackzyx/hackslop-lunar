export function spherePixels(sun, n, texture) {
  const pixels = new Uint8ClampedArray(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u = (2 * i + 1) / n - 1, v = 1 - (2 * j + 1) / n, rr = u * u + v * v;
    if (rr > 1) continue;
    const depth = Math.sqrt(1 - rr);
    const incidence = Math.max(0, v * sun[0] + u * sun[1] - depth * sun[2]);
    const scatter = incidence / Math.max(.001, incidence + depth);
    const brightness = .025 + .975 * (.76 * incidence ** .7 + .24 * scatter);
    const o = 4 * (j * n + i);
    if (texture) {
      const lon = Math.atan2(u, v), lat = -Math.acos(Math.sqrt(rr));
      const tx = Math.min(texture.width - 1, Math.floor((lon / (2 * Math.PI) + .5) * texture.width));
      const ty = Math.min(texture.height - 1, Math.floor((.5 - lat / Math.PI) * texture.height));
      const source = 4 * (ty * texture.width + tx);
      for (let channel = 0; channel < 3; channel++) pixels[o + channel] = texture.data[source + channel] * (.12 + 1.25 * brightness);
    } else {
      pixels[o] = 14 + 226 * brightness; pixels[o + 1] = 14 + 220 * brightness; pixels[o + 2] = 18 + 205 * brightness;
    }
    pixels[o + 3] = 255 * Math.min(1, (1 - Math.sqrt(rr)) * n / 2 + .5);
  }
  return pixels;
}

export function earthPixels(light, n, texture) {
  const pixels = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (2 * x + 1) / n - 1, v = (2 * y + 1) / n - 1;
    const radius = Math.hypot(u, v);
    if (radius > 1) continue;
    const depth = Math.sqrt(1 - radius * radius);
    const incidence = Math.max(0, u * light[0] + v * light[1]);
    const brightness = .14 + 1.03 * incidence ** .65;
    const atmosphere = (1 - depth) ** 3 * (.08 + .92 * incidence);
    const offset = 4 * (y * n + x);
    const source = texture?.data;
    pixels[offset] = (source?.[offset] ?? 30) * brightness + 34 * atmosphere;
    pixels[offset + 1] = (source?.[offset + 1] ?? 110) * brightness + 108 * atmosphere;
    pixels[offset + 2] = (source?.[offset + 2] ?? 195) * brightness + 192 * atmosphere;
    pixels[offset + 3] = 255 * Math.min(1, (1 - radius) * n / 2 + .5);
  }
  return pixels;
}

