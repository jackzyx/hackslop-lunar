// SVG chart and map overlays from computed data.
import { WINDOW_H, maskAt } from "@/domain/metrics.js";
import { toMap } from "@/terrain/shadow.js";
import { data, sites, vis } from "@/lib/data.js";

const RAD = Math.PI / 180;

// --- one-month strip: Sun visible (any part of the disc) and Earth in view, hour by hour
export const TL = { x0: 64, x1: 596 };
// --- 360 deg horizon panorama with the Sun and Earth paths over the 30 days
export const P = { x0: 40, x1: 596, y0: 8, y1: 160 };
const px = (az) => P.x0 + (az / 360) * (P.x1 - P.x0);
export function panorama(mask, e, i0, [lo, hi]) {
  const py = (el) => Math.min(P.y1 + 2, Math.max(P.y0, P.y1 - ((el - lo) / (hi - lo)) * (P.y1 - P.y0)));
  const step = [1, 2, 5, 10].find((s) => (hi - lo) / s <= 8) ?? 20; // at most ~8 gridlines
  let g = "";
  for (let el = Math.ceil(lo / step) * step; el <= hi; el += step) {
    g += `<line class="${el === 0 ? "axis" : "grid"}" x1="${P.x0}" x2="${P.x1}" y1="${py(el)}" y2="${py(el)}"/><text x="${P.x0 - 6}" y="${py(el) + 4}" text-anchor="end">${el}°</text>`;
  }
  ["N", "E", "S", "W", "N"].forEach((c, k) => {
    g += `<text x="${px(k * 90)}" y="180" text-anchor="${k === 0 ? "start" : k === 4 ? "end" : "middle"}">${c} ${k * 90}°</text>`;
  });
  const sky = mask.map((h, k) => `${px(k / 2).toFixed(1)},${py(h).toFixed(1)}`).join(" ") + ` ${px(360)},${py(mask[0]).toFixed(1)}`;
  const path = (az, el) => {
    let d = "", prev = null;
    for (let k = i0; k < i0 + WINDOW_H; k++) {
      d += (prev === null || Math.abs(az[k] - prev) > 180 ? "M" : "L") + px(az[k]).toFixed(1) + "," + py(el[k]).toFixed(1);
      prev = az[k];
    }
    return d;
  };
  const paths = `<path class="sun-line" d="${path(e.sun_az, e.sun_el)}"/><path class="earth-line" d="${path(e.earth_az, e.earth_el)}"/>`;
  // Marker for the landing instant: filled when in view, hollow when behind the skyline.
  const mark = (cls, az, el, label, up) =>
    `<circle class="${cls}${up ? "" : " hidden"}" cx="${px(az).toFixed(1)}" cy="${py(el).toFixed(1)}" r="6"/>` +
    `<text class="ink" x="${(px(az) + (az > 300 ? -12 : 12)).toFixed(1)}" y="${(py(el) - 10).toFixed(1)}" text-anchor="${az > 300 ? "end" : "start"}">${label}${up ? "" : " (HIDDEN)"}</text>`;
  const sunUp = e.sun_el[i0] > maskAt(mask, e.sun_az[i0]), earthUp = e.earth_el[i0] > maskAt(mask, e.earth_az[i0]);
  return (
    g + paths +
    `<polygon class="terrain" points="${px(0)},${P.y1 + 2} ${sky} ${px(360)},${P.y1 + 2}"/><polyline class="skyline" points="${sky}"/>` +
    `<g class="behind">${paths}</g>` +
    mark("sun", e.sun_az[i0], e.sun_el[i0], "SUN", sunUp) + mark("earth", e.earth_az[i0], e.earth_el[i0], "EARTH", earthUp)
  );
}

// One elevation scale for both panoramas so the two sites compare by eye.
export function yRange(ids) {
  let lo = Infinity, hi = -Infinity;
  for (const id of ids) {
    const e = data.ephemeris.sites[id];
    for (const h of sites[id].horizon) { lo = Math.min(lo, h); hi = Math.max(hi, h); }
    for (let k = 0; k < e.sun_el.length; k++) hi = Math.max(hi, e.sun_el[k], e.earth_el[k]);
  }
  return [Math.floor(lo - 1), Math.ceil(hi + 0.5)];
}

// --- map: the square view (km on the polar map) and its HUD overlay
export function mapOverlay(view, picks, i0, size, height = size) {
  const kmPx = height / (2 * view.half);
  const toPx = ([x, y]) => [size / 2 + (x - view.cx) * kmPx, height / 2 - (y - view.cy) * kmPx];
  const inView = ([x, y], m = 10) => x > -m && x < size + m && y > -m && y < height + m;
  const pole = toPx([0, 0]);
  const km = [1, 2, 5, 10, 20, 50, 100].filter((d) => d <= view.half / 2).pop();
  let g = "";

  // Polar grid: rings every `km` from the pole, meridians every 30 deg (0 deg = Earth-facing, up).
  const far = Math.hypot(Math.abs(view.cx) + view.half * size / height, Math.abs(view.cy) + view.half), off = Math.hypot(view.cx, view.cy);
  const toward = off > 1 ? [view.cx / off, view.cy / off] : [0, 1]; // ring labels sit on the line toward the view centre
  for (let r = km; r <= far; r += km) {
    g += `<circle class="ring" cx="${pole[0].toFixed(1)}" cy="${pole[1].toFixed(1)}" r="${(r * kmPx).toFixed(1)}"/>`;
    const lp = toPx([toward[0] * r, toward[1] * r]);
    if (inView(lp, -14)) g += `<text class="grid-label" x="${(lp[0] + 4).toFixed(1)}" y="${(lp[1] - 4).toFixed(1)}">${r} KM</text>`;
  }
  const names = { 0: "0°", 90: "90°E", 180: "180°", 270: "90°W" };
  for (let lon = 0; lon < 360; lon += 30) {
    const dir = [Math.sin(lon * RAD), Math.cos(lon * RAD)];
    const end = toPx([dir[0] * far, dir[1] * far]);
    g += `<line class="meridian" x1="${pole[0].toFixed(1)}" y1="${pole[1].toFixed(1)}" x2="${end[0].toFixed(1)}" y2="${end[1].toFixed(1)}"/>`;
    if (!(lon in names)) continue;
    for (let r = far; r > 0; r -= view.half / 25) {
      const p = toPx([dir[0] * r, dir[1] * r]);
      if (inView(p, -18)) { g += `<text class="grid-label" x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" text-anchor="middle">${names[lon]}</text>`; break; }
    }
  }
  if (inView(pole)) g += `<path class="cross" d="M${pole[0] - 9},${pole[1]}h18M${pole[0]},${pole[1] - 9}v18"/><text x="${pole[0] + 10}" y="${pole[1] - 8}">POLE</text>`;

  // Sites: the other six as small lettered pins, the chosen two with a target bracket and a name.
  const pickY = picks.map((id) => toPx(toMap(sites[id].lat, sites[id].lon))[1]);
  const chosenLast = [...data.sites].sort((a, b) => picks.includes(a.id) - picks.includes(b.id));
  for (const site of chosenLast) {
    const p = toPx(toMap(site.lat, site.lon)), k = picks.indexOf(site.id), [x, y] = p;
    if (!inView(p)) continue;
    if (k < 0) { g += `<circle class="pin-other" cx="${x}" cy="${y}" r="3"/><text class="grid-label" x="${x + 6}" y="${y + 4}">${site.id}</text>`; continue; }
    const lit = vis(site.id).sun[i0] > 0, above = pickY[k] <= pickY[1 - k]; // upper pick labelled above, lower below
    g += `<path class="bracket" d="M${x - 13},${y - 7}v-6h6M${x + 7},${y - 13}h6v6M${x + 13},${y + 7}v6h-6M${x - 7},${y + 13}h-6v-6"/>` +
      `<circle class="${lit ? "pin-lit" : "pin-dark"}" cx="${x}" cy="${y}" r="5.5"/>` +
      `<text class="pin-label" x="${Math.min(size - 80, Math.max(80, x))}" y="${y + (above ? -20 : 30)}" text-anchor="middle">${k + 1} · ${site.name.toUpperCase()}${lit ? "" : " · SUN HIDDEN"}</text>`;
  }
  const len = km * kmPx;
  g += `<path class="scale" d="M14,${height - 14}h${len.toFixed(1)}M14,${height - 18}v8M${(14 + len).toFixed(1)},${height - 18}v8"/><text x="14" y="${height - 24}">${km} KM</text>`;
  return g;
}
