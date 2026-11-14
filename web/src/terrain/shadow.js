// Polar stereographic terrain, kilometres; stored heights are int16 metres.
// +y points to longitude 0, +x to 90 E. Sun vector uses the MOON_ME frame.
import { sunFraction } from "../domain/metrics.js";

export const R_KM = 1737.4;
export const TERRAIN = { n: 1000, px: 0.5, half: 250 }; // keep in step with scripts/export_terrain.py
const RAD = Math.PI / 180;

export function terrainFrom(buffer, geometry = TERRAIN) {
  const h = new Int16Array(buffer);
  if (h.length !== geometry.n * geometry.n) throw new Error(`terrain file has ${h.length} heights, expected ${geometry.n ** 2}`);
  let hmax = -Infinity;
  for (const v of h) if (v > hmax) hmax = v;
  return { ...geometry, h, hmax: hmax / 1000 };
}

// Sun unit vector (MOON_ME) from its azimuth and elevation seen at one site. The Sun is so far
// away that the same vector holds over the whole region (parallax under 0.006 deg).
export function sunVector(latDeg, lonDeg, azDeg, elDeg) {
  const la = latDeg * RAD, lo = lonDeg * RAD, az = azDeg * RAD, el = elDeg * RAD;
  const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const east = [-Math.sin(lo), Math.cos(lo), 0];
  const north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const a = Math.cos(el) * Math.sin(az), b = Math.cos(el) * Math.cos(az), c = Math.sin(el);
  return [0, 1, 2].map((i) => a * east[i] + b * north[i] + c * up[i]);
}

// Map position (km) of a lat/lon on the terrain grid's projection.
export function toMap(latDeg, lonDeg) {
  const rho = 2 * R_KM * Math.tan(((90 + latDeg) * RAD) / 2);
  return [rho * Math.sin(lonDeg * RAD), rho * Math.cos(lonDeg * RAD)];
}

export function mapView(picks, zoom) {
  if (!zoom || !picks.length) return { cx: 0, cy: 0, half: 170 };
  const [a, b = a] = picks.map(({ lat, lon }) => toMap(lat, lon));
  const half = Math.min(170, Math.max(30, 1.4 * Math.hypot(a[0] - b[0], a[1] - b[1]) + 20)); // room around the pins to place custom sites
  return { cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, half };
}

export function mapViewport(view, aspect, zoom, terrain = TERRAIN) {
  const edge = terrain.half - terrain.px;
  const half = Math.min(view.half, (zoom ? edge : edge * 0.9) / Math.max(1, aspect));
  const xLimit = Math.max(0, edge - half * aspect);
  const yLimit = edge - half;
  return {
    cx: Math.min(xLimit, Math.max(-xLimit, view.cx)),
    cy: Math.min(yLimit, Math.max(-yLimit, view.cy)),
    half,
    aspect,
  };
}

export const MIN_MAP_HALF = 5;

export function transformMapViewport(view, scale, from, to, zoom, terrain) {
  const { half } = mapViewport({
    ...view,
    half: Math.max(MIN_MAP_HALF, view.half * scale),
  }, view.aspect, zoom, terrain);
  return mapViewport({
    cx: view.cx + (from.x * view.half - to.x * half),
    cy: view.cy + (from.y * view.half - to.y * half),
    half,
  }, view.aspect, zoom, terrain);
}

// The Sun seen from map point (x, y): sine of its elevation, cosine of it, and the unit map
// direction toward it. Each point gets its own elevation because the surface curves.
export function localSun(sun, x, y) {
  const c = 2 * Math.atan(Math.hypot(x, y) / (2 * R_KM)), lam = Math.atan2(x, y);
  const sc = Math.sin(c), cc = Math.cos(c), sl = Math.sin(lam), cl = Math.cos(lam);
  const up = sun[0] * sc * cl + sun[1] * sc * sl - sun[2] * cc; // up = (sc cl, sc sl, -cc)
  const e = -sun[0] * sl + sun[1] * cl; // east = (-sl, cl, 0); on the map (cl, -sl)
  const n = sun[0] * cc * cl + sun[1] * cc * sl + sun[2] * sc; // north = outward on the map (sl, cl)
  const hz = Math.hypot(e, n) || 1;
  return { sinEl: up, cosEl: hz, dx: (n * sl + e * cl) / hz, dy: (n * cl - e * sl) / hz };
}

// RGBA pixels for a shadeView result: lit = warm white, shadow = near black, NaN = transparent.
export function paint(b, px) {
  for (let k = 0; k < b.length; k++) {
    const v = b[k], o = 4 * k;
    if (Number.isNaN(v)) { px[o + 3] = 0; continue; }
    px[o] = 14 + 226 * v; px[o + 1] = 14 + 220 * v; px[o + 2] = 18 + 205 * v; px[o + 3] = 255;
  }
}

export function heightAt(t, x, y) {
  const c = (x + t.half) / t.px - 0.5, r = (t.half - y) / t.px - 0.5;
  if (!(c >= 0 && r >= 0 && c < t.n - 1 && r < t.n - 1)) return NaN;
  const c0 = c | 0, r0 = r | 0, fc = c - c0, fr = r - r0, i = r0 * t.n + c0, h = t.h;
  return ((h[i] * (1 - fc) + h[i + 1] * fc) * (1 - fr) + (h[i + t.n] * (1 - fc) + h[i + t.n + 1] * fc) * fr) / 1000;
}

// Brightness 0..1 for size x height pixels. `half` is the vertical half-span in km;
// the horizontal extent follows the aspect ratio, with equal km per pixel on both axes. Row 0 is at
// the top; NaN outside the terrain. Brightness = visible share of the Sun's disc x slope shading.
// shortcut: marches a straight map line with map distance as ground distance (both off by < 0.6 %
// at 250 km from the pole); fine for a picture, the site numbers come from the horizon masks.
export function shadeView(t, sun, view, size, height = size) {
  const out = new Float32Array(size * height), step = (2 * view.half) / height, R2 = 2 * R_KM;
  const tanLoOf = (sinEl, cosEl) => Math.tan(Math.atan2(sinEl, cosEl) - 0.2665 * RAD);
  for (let j = 0; j < height; j++) {
    const y = view.cy + view.half - (j + 0.5) * step;
    for (let i = 0; i < size; i++) {
      const x = view.cx + (i + 0.5 - size / 2) * step, h0 = heightAt(t, x, y);
      if (Number.isNaN(h0)) { out[j * size + i] = NaN; continue; }
      const s0 = localSun(sun, x, y), el = Math.atan2(s0.sinEl, s0.cosEl);
      const tanHi = Math.tan(el + 0.2665 * RAD), tanLo = tanLoOf(s0.sinEl, s0.cosEl);
      let top = -Infinity; // tan of the highest terrain angle toward the Sun
      for (let s = t.px / 2; s < 2 * t.half; s *= 1.025) {
        const hs = heightAt(t, x + s0.dx * s, y + s0.dy * s);
        if (Number.isNaN(hs)) break;
        const a = (hs - h0) / s - s / R2; // includes the curvature drop s^2 / 2R
        if (a > top && (top = a) > tanHi) break; // whole disc hidden
        if ((t.hmax - h0) / s - s / R2 < Math.max(top, tanLo)) break; // nothing further can matter
      }
      const lit = sunFraction(el / RAD, Math.atan(top) / RAD);
      // Lit ground: Sun-facing slopes brighter (cosine of the incidence angle, full white at ~7 deg).
      // Shadow: a faint fixed relief (light from the upper left) so craters stay readable.
      const gx = (heightAt(t, x + t.px, y) - heightAt(t, x - t.px, y)) / (2 * t.px) || 0;
      const gy = (heightAt(t, x, y + t.px) - heightAt(t, x, y - t.px)) / (2 * t.px) || 0;
      const norm = Math.sqrt(1 + gx * gx + gy * gy);
      const lam = (s0.sinEl - s0.cosEl * (gx * s0.dx + gy * s0.dy)) / norm;
      const amb = 0.03 + 0.07 * Math.min(1, Math.max(0, 0.5 + 4 * (gx - gy) / norm));
      out[j * size + i] = lit * (0.35 + 0.65 * Math.min(1, Math.max(0, lam / 0.12))) + (1 - lit) * amb;
    }
  }
  return out;
}
