export function spherePixels(sun, n, texture) {
  const pixels = new Uint8ClampedArray(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u = (2 * i + 1) / n - 1, v = 1 - (2 * j + 1) / n, rr = u * u + v * v;
    if (rr > 1) continue;
    const brightness = .04 + .96 * Math.max(0, v * sun[0] + u * sun[1] - Math.sqrt(1 - rr) * sun[2]) ** .7;
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
    pixels[o + 3] = 255;
  }
  return pixels;
}

