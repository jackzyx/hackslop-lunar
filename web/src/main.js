import data from "./mock-data.json";
import { visibility, windowMetrics, verdictDelay, grade, rig, maskAt, WINDOW_H, MAX_DELAY_D } from "./metrics.js";

const H = 3600e3, DAY = 86400e3, rad = Math.PI / 180;
const t0 = Date.parse(data.ephemeris.start_utc);
const sites = Object.fromEntries(data.sites.map((s) => [s.id, s]));
const visCache = {};
const vis = (id) => (visCache[id] ??= visibility(sites[id].horizon, data.ephemeris.sites[id]));
const state = { date: "2026-11-20", delay: 0, picks: ["A", "B"] };

const $ = (s) => document.querySelector(s);
const tip = $("#tip");
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const fmtDate = (ms, o) => new Date(ms).toLocaleDateString("en-IE", { timeZone: "UTC", day: "numeric", month: "short", ...o });
const fmtTime = (ms) => new Date(ms).toLocaleString("en-IE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dur = (h) => (h < 48 ? `${Math.round(h)} h` : `${Math.floor(h / 24)} d ${Math.round(h % 24)} h`);

// Planned dates must leave room for the whole slider range plus the 30-day window.
const dateIn = $("#date");
dateIn.min = iso(t0 + MAX_DELAY_D * DAY);
dateIn.max = iso(t0 + data.ephemeris.count * H - (MAX_DELAY_D + 30) * DAY);
dateIn.value = state.date;
dateIn.onchange = () => {
  if (dateIn.value && dateIn.value >= dateIn.min && dateIn.value <= dateIn.max) { state.date = dateIn.value; render(); }
  else dateIn.value = state.date;
};
const slider = $("#delay");
slider.oninput = () => { state.delay = +slider.value; render(); };

function hover(svg, text) {
  svg.onmousemove = (ev) => {
    const r = svg.getBoundingClientRect();
    const s = text(((ev.clientX - r.left) / r.width) * 600);
    tip.hidden = !s;
    if (!s) return;
    tip.textContent = s;
    const flip = ev.clientX > innerWidth - 360;
    tip.style.left = (flip ? ev.clientX - tip.offsetWidth - 14 : ev.clientX + 14) + "px";
    tip.style.top = ev.clientY + 16 + "px";
  };
  svg.onmouseleave = () => (tip.hidden = true);
}

// --- one-month strip: Sun visible (any part of the disc) and Earth in view, hour by hour
const TL = { x0: 64, x1: 596 };
const tlx = (h) => TL.x0 + (h / WINDOW_H) * (TL.x1 - TL.x0);
function runs(arr, i0) {
  const out = [];
  let s = -1;
  for (let k = 0; k <= WINDOW_H; k++) {
    const on = k < WINDOW_H && arr[i0 + k] > 0;
    if (on && s < 0) s = k;
    else if (!on && s >= 0) { out.push([s, k]); s = -1; }
  }
  return out;
}
function timeline(v, i0) {
  const row = (y, label, cls, rs) =>
    `<text class="ink" x="0" y="${y + 15}">${label}</text><rect class="track" x="${TL.x0}" y="${y}" width="${TL.x1 - TL.x0}" height="20" rx="3"/>` +
    rs.map(([a, b]) => `<rect class="${cls}" x="${tlx(a).toFixed(1)}" y="${y}" width="${(tlx(b) - tlx(a)).toFixed(1)}" height="20" rx="2"/>`).join("");
  let ticks = "";
  for (let d = 0; d <= 30; d += 5) {
    const anchor = d === 0 ? "start" : d === 30 ? "end" : "middle";
    ticks += `<text x="${tlx(d * 24)}" y="80" text-anchor="${anchor}">${fmtDate(t0 + (i0 + d * 24) * H)}</text>`;
  }
  return row(4, "Sun", "sun", runs(v.sun, i0)) + row(32, "Earth", "earth", runs(v.earth, i0)) + ticks;
}

// --- 360 deg horizon panorama with the Sun and Earth paths over the 30 days
const P = { x0: 40, x1: 596, y0: 8, y1: 160 };
const px = (az) => P.x0 + (az / 360) * (P.x1 - P.x0);
function panorama(mask, e, i0, [lo, hi]) {
  const py = (el) => Math.min(P.y1 + 2, Math.max(P.y0, P.y1 - ((el - lo) / (hi - lo)) * (P.y1 - P.y0)));
  const step = hi - lo > 8 ? 2 : 1;
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
    `<circle class="${cls}${up ? "" : " hidden"}" cx="${px(az).toFixed(1)}" cy="${py(el).toFixed(1)}" r="7"/>` +
    `<text class="ink" x="${(px(az) + (az > 300 ? -12 : 12)).toFixed(1)}" y="${(py(el) - 10).toFixed(1)}" text-anchor="${az > 300 ? "end" : "start"}">${label}${up ? "" : " (hidden)"}</text>`;
  const sunUp = e.sun_el[i0] > maskAt(mask, e.sun_az[i0]), earthUp = e.earth_el[i0] > maskAt(mask, e.earth_az[i0]);
  return (
    g + paths +
    `<polygon class="terrain" points="${px(0)},${P.y1 + 2} ${sky} ${px(360)},${P.y1 + 2}"/><polyline class="skyline" points="${sky}"/>` +
    `<g class="behind">${paths}</g>` +
    mark("sun", e.sun_az[i0], e.sun_el[i0], "Sun", sunUp) + mark("earth", e.earth_az[i0], e.earth_el[i0], "Earth", earthUp)
  );
}

// One elevation scale for both panoramas so the two sites compare by eye.
function yRange(ids) {
  let lo = Infinity, hi = -Infinity;
  for (const id of ids) {
    const e = data.ephemeris.sites[id];
    for (const h of sites[id].horizon) { lo = Math.min(lo, h); hi = Math.max(hi, h); }
    for (let k = 0; k < e.sun_el.length; k++) hi = Math.max(hi, e.sun_el[k], e.earth_el[k]);
  }
  return [Math.floor(lo - 1), Math.ceil(hi + 0.5)];
}

// --- schematic polar map: 0 deg longitude up, east to the right.
// shortcut: radius grows as sqrt(distance from pole) so neighbouring sites separate;
// replace with the true-scale LOLA hillshade plus a zoom inset once Science ships it.
function polarMap() {
  const c = 200, maxCo = 6;
  const rOf = (co) => 180 * Math.sqrt(co / maxCo);
  const pt = (lat, lon) => { const r = rOf(90 + lat); return [c + r * Math.sin(lon * rad), c - r * Math.cos(lon * rad)]; };
  let g = "";
  for (const co of [0.5, 1, 2, 4, 6]) g += `<circle class="grid-ring" cx="${c}" cy="${c}" r="${rOf(co)}"/><text x="${c + 4}" y="${c - rOf(co) + 14}">${90 - co}° S</text>`;
  [[0, "0°"], [90, "90° E"], [180, "180°"], [270, "90° W"]].forEach(([lon, label]) => {
    const [x, y] = pt(-90 + maxCo, lon), lx = c + 196 * Math.sin(lon * rad), ly = c - 196 * Math.cos(lon * rad);
    g += `<line class="grid" x1="${c}" y1="${c}" x2="${x}" y2="${y}"/><text x="${lx.toFixed(1)}" y="${(ly + 5).toFixed(1)}" text-anchor="middle">${label}</text>`;
  });
  const pickX = state.picks.map((id) => pt(sites[id].lat, sites[id].lon)[0]);
  for (const site of data.sites) {
    const [x, y] = pt(site.lat, site.lon), k = state.picks.indexOf(site.id);
    const left = k >= 0 && x < pickX[1 - k]; // label on the side away from the other picked site
    g += k < 0
      ? `<circle class="pin" cx="${x}" cy="${y}" r="4"/><text x="${x + 7}" y="${y + 4}">${site.id}</text>`
      : `<circle class="pin-on" cx="${x}" cy="${y}" r="7"/><text class="ink" x="${x + (left ? -11 : 11)}" y="${y + 5}" text-anchor="${left ? "end" : "start"}">${site.name}</text>`;
  }
  return g;
}

// --- site columns
const cols = [...document.querySelectorAll(".site")].map((el, c) => {
  el.innerHTML = `<select aria-label="Site ${c + 1}">${data.sites.map((s) => `<option value="${s.id}">${s.name} · ${s.kind}</option>`).join("")}</select>
    <p class="mission"></p>
    <div class="head"><span class="big"></span><span class="status"></span></div>
    <p class="sub"></p><p class="sunline"></p><p class="verdict"></p><dl class="nums"></dl>
    <svg class="timeline" viewBox="0 0 600 84" role="img" aria-label="Sun and Earth over the 30 days"></svg>
    <svg class="pano" viewBox="0 0 600 186" role="img" aria-label="Skyline all around the site with the Sun and Earth paths"></svg>`;
  const col = { q: (s) => el.querySelector(s) };
  const sel = col.q("select");
  sel.value = state.picks[c];
  sel.onchange = () => { state.picks[c] = sel.value; render(); };
  hover(col.q(".timeline"), (x) => {
    const k = Math.floor(((x - TL.x0) / (TL.x1 - TL.x0)) * WINDOW_H);
    if (k < 0 || k >= WINDOW_H) return null;
    const v = vis(col.id), i = col.i0 + k;
    return `${fmtTime(t0 + i * H)} UTC · Sun ${Math.round(v.sun[i] * 100)} % visible · Earth ${v.earth[i] ? "in view" : "hidden"}`;
  });
  hover(col.q(".pano"), (x) => {
    const az = ((x - P.x0) / (P.x1 - P.x0)) * 360;
    if (az < 0 || az >= 360) return null;
    return `Azimuth ${az.toFixed(0)}° · skyline ${maskAt(sites[col.id].horizon, az).toFixed(1)}° up`;
  });
  return col;
});

const STATUS = { good: "✓ Good", warning: "! Marginal", critical: "✕ Poor" };
function nextEvent(m) {
  const ev = [["Sunset", m.sunsetIn], ["Earthset", m.earthsetIn]].filter(([, h]) => h !== null);
  if (!ev.length) return ["Next sunset or Earthset", "Both down"];
  const [name, h] = ev.reduce((a, b) => (b[1] < a[1] ? b : a));
  return h === Infinity ? ["Next sunset or Earthset", "None in 30 days"] : [`${name} in`, dur(h)];
}

function renderCol(col, id, i0, iPlanned, yr) {
  Object.assign(col, { id, i0 });
  const v = vis(id), m = windowMetrics(v, i0), g = grade(m.sunlit), big = col.q(".big");
  big.className = `big ${g}`;
  big.innerHTML = `${Math.round(m.sunlit)}<small> of ${WINDOW_H} h</small>`;
  col.q(".status").textContent = STATUS[g];
  col.q(".sub").textContent = `sunlight in the 30 days after landing (${Math.round((m.sunlit / WINDOW_H) * 100)} %)`;
  col.q(".mission").textContent = sites[id].mission ?? "Mission: pending Story's site list";
  // Solar elevation and its margin over the skyline in the Sun's direction, at the landing instant.
  const e = data.ephemeris.sites[id], el = e.sun_el[i0], margin = el - maskAt(sites[id].horizon, e.sun_az[i0]);
  const deg = (x) => `${x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)}°`;
  col.q(".sunline").textContent = `At landing: Sun at ${deg(el)} elevation, ${deg(Math.abs(margin))} ${margin >= 0 ? "above" : "below"} the skyline`;
  const d = verdictDelay(v, iPlanned);
  col.q(".verdict").textContent =
    d === null ? `Holds through a ${MAX_DELAY_D}-day delay` : d === 0 ? "Under half sunlight even on time" : `Falls below half sunlight with a ${d}-day delay`;
  const nums = [["Longest dark gap", dur(m.darkGap)], ["Earth in view", `${m.earth} h`], nextEvent(m)];
  col.q(".nums").innerHTML = nums.map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`).join("");
  col.q(".timeline").innerHTML = timeline(v, i0);
  col.q(".pano").innerHTML = panorama(sites[id].horizon, data.ephemeris.sites[id], i0, yr);
}

function render() {
  const iPlanned = (Date.parse(state.date + "T00:00:00Z") - t0) / H, i0 = iPlanned + state.delay * 24;
  const when = fmtDate(t0 + i0 * H, { weekday: "short", year: "numeric" });
  const n = Math.abs(state.delay), days = `${n} day${n === 1 ? "" : "s"}`;
  $("#delay-out").textContent = state.delay === 0 ? `On time · lands ${when}` : `${state.delay > 0 ? "+" : "−"}${days} · lands ${when}`;
  const yr = yRange(state.picks);
  cols.forEach((col, c) => renderCol(col, state.picks[c], i0, iPlanned, yr));
  $("#map").innerHTML = polarMap();
  const r = rig(data.rig.subsolar_lon[i0], data.rig.subsolar_lat[i0]);
  $("#rig").textContent = `Table to ${r.tableDeg.toFixed(1)}°, lamp to ${r.lampMm < 0 ? "−" : "+"}${Math.abs(r.lampMm).toFixed(0)} mm`;
  $("#rig-note").textContent = `For ${when}, 00:00 UTC. Lamp 3.00 m from the model, heights ×3, lamp height measured from the pole's level.`;
}

$("#foot").textContent = `Half sunlight = 360 of 720 hours. Verdicts test delays of 0 to ${MAX_DELAY_D} days from the planned date. Landing at 00:00 UTC. Mast height 2 m. Hover the charts for detail.`;
render();
