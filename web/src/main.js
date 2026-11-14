import data from "./mock-data.json";
import validation from "./validation.json";
import { visibility, windowMetrics, verdictDelay, grade, maskAt, WINDOW_H, MAX_DELAY_D } from "./metrics.js";
import { terrainFrom, shadeView, sunVector, toMap, paint } from "./shadow.js";
import { playIntro } from "./intro.js";

const H = 3600e3, DAY = 86400e3;
const t0 = Date.parse(data.ephemeris.start_utc);
const sites = Object.fromEntries(data.sites.map((s) => [s.id, s]));
const visCache = {};
const vis = (id) => (visCache[id] ??= visibility(sites[id].horizon, data.ephemeris.sites[id]));
const state = { date: "2026-11-20", delay: 0, picks: ["A", "B"], zoom: true };

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

// --- sunlight map: real terrain, shadows at the landing instant (shadow.js). 0 deg lon up, 90 E right.
// The Sun direction comes from the first chosen site's row of the same table the cards use.
const MAP = 360, ctx = $("#shade").getContext("2d"), img = ctx.createImageData(MAP, MAP);
let terrain = null, mapFrame = 0;
const sunAt = (id, i) => { const e = data.ephemeris.sites[id]; return sunVector(sites[id].lat, sites[id].lon, e.sun_az[i], e.sun_el[i]); };
fetch("terrain_500m.bin")
  .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
  .then((b) => { terrain = terrainFrom(b); render(); })
  .catch((err) => ($("#map-cap").textContent = `Terrain did not load (${err.message}).`))
  .finally(() => (matchMedia("(prefers-reduced-motion: reduce)").matches ? ($("#intro").hidden = true) : intro()));
$("#intro-btn").onclick = () => intro();

// STARS intro: zoom from the Sun to the landing region for the current landing instant.
function intro() {
  const i0 = landingIndex(), ms = t0 + i0 * H;
  playIntro({ ms, sun: sunAt(state.picks[0], i0), terrain, picks: state.picks.map((id) => sites[id]), when: fmtDate(ms, { year: "numeric" }) });
}
$("#zoom").onclick = () => { state.zoom = !state.zoom; render(); };

function mapView() {
  if (!state.zoom) return { cx: 0, cy: 0, half: 170 };
  const [a, b] = state.picks.map((id) => toMap(sites[id].lat, sites[id].lon));
  const half = Math.min(170, Math.max(12, 0.7 * Math.hypot(a[0] - b[0], a[1] - b[1]) + 8));
  return { cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, half };
}

function drawMap(i0, when) {
  const view = mapView(), id = state.picks[0];
  const toPx = ([x, y]) => [((x - view.cx + view.half) / (2 * view.half)) * MAP, ((view.cy + view.half - y) / (2 * view.half)) * MAP];
  if (terrain) {
    paint(shadeView(terrain, sunAt(id, i0), view, MAP), img.data);
    ctx.putImageData(img, 0, 0);
  }
  const inView = ([x, y]) => x > -10 && x < MAP + 10 && y > -10 && y < MAP + 10;
  let g = "";
  const pole = toPx([0, 0]);
  if (inView(pole)) g += `<path class="scale" d="M${pole[0] - 6},${pole[1]}h12M${pole[0]},${pole[1] - 6}v12"/><text x="${pole[0] + 9}" y="${pole[1] - 6}">Pole</text>`;
  const pickY = state.picks.map((id) => toPx(toMap(sites[id].lat, sites[id].lon))[1]);
  const chosenLast = [...data.sites].sort((a, b) => state.picks.includes(a.id) - state.picks.includes(b.id));
  for (const site of chosenLast) {
    const p = toPx(toMap(site.lat, site.lon)), k = state.picks.indexOf(site.id);
    if (!inView(p)) continue;
    if (k < 0) { g += `<circle class="pin-dark" cx="${p[0]}" cy="${p[1]}" r="3"/><text x="${p[0] + 6}" y="${p[1] + 4}">${site.id}</text>`; continue; }
    // Upper chosen site labelled above its pin, lower one below, so close pairs never collide.
    const lit = vis(site.id).sun[i0] > 0, above = pickY[k] <= pickY[1 - k];
    g += `<circle class="${lit ? "pin-lit" : "pin-dark"}" cx="${p[0]}" cy="${p[1]}" r="7"/>` +
      `<text x="${Math.min(MAP - 75, Math.max(75, p[0]))}" y="${p[1] + (above ? -12 : 22)}" text-anchor="middle">${site.name}${lit ? "" : " (Sun hidden)"}</text>`;
  }
  const km = [1, 2, 5, 10, 20, 50, 100].filter((d) => d <= view.half / 2).pop(), len = (km / (2 * view.half)) * MAP;
  g += `<path class="scale" d="M14,${MAP - 14}h${len.toFixed(1)}"/><text x="14" y="${MAP - 20}">${km} km</text>`;
  $("#map").innerHTML = g;
  $("#zoom").textContent = state.zoom ? "Show the whole region" : "Close-up on the two sites";
  $("#map-cap").textContent = terrain
    ? `Real NASA terrain, 500 m detail. Light = sunlit, black = shadow, at landing ${when}, 00:00 UTC. 0° longitude (the Earth-facing side) at the top.`
    : "Loading terrain…";
}

// --- site columns
const cols = [...document.querySelectorAll(".site")].map((el, c) => {
  el.innerHTML = `<select aria-label="Site ${c + 1}">${data.sites.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}</select>
    <p class="mission"></p>
    <div class="head"><span class="big"></span><span class="status"></span></div>
    <p class="sub"></p>
    <div class="hbar sun"><span>Sunlight</span><i class="track"><i class="fill"></i></i><b></b></div>
    <div class="hbar earth"><span>Earth in view</span><i class="track"><i class="fill"></i></i><b></b></div>
    <p class="sunline"></p><p class="verdict"></p><dl class="nums"></dl>`;
  // The month strip and skyline panorama live in a detail card under the hero row.
  const det = document.querySelectorAll(".detail")[c];
  det.innerHTML = `<h2 class="detail-name"></h2><h3>Sun and Earth over the 30 days</h3>
    <svg class="timeline" viewBox="0 0 600 84" role="img" aria-label="Sun and Earth over the 30 days"></svg>
    <h3>Skyline all around the site, with the Sun and Earth paths</h3>
    <svg class="pano" viewBox="0 0 600 186" role="img" aria-label="Skyline all around the site with the Sun and Earth paths"></svg>`;
  const col = { q: (s) => el.querySelector(s) ?? det.querySelector(s) };
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
  // Sun and Earth bars: same 720 h scale, updated in place so the width change animates on a slip.
  for (const [cls, h] of [["sun", m.sunlit], ["earth", m.earth]]) {
    col.q(`.hbar.${cls} .fill`).style.width = `${((h / WINDOW_H) * 100).toFixed(1)}%`;
    col.q(`.hbar.${cls} b`).textContent = `${Math.round(h)} h`;
  }
  const s = sites[id], kind = s.kind && s.kind.toLowerCase() !== s.name.toLowerCase() ? s.kind : null; // the site type, unless the name says it
  col.q(".mission").textContent = [kind, s.mission ?? "Mission: pending Story's site list"].filter(Boolean).join(" · ");
  col.q(".detail-name").textContent = sites[id].name;
  // Solar elevation and its margin over the skyline in the Sun's direction, at the landing instant.
  const e = data.ephemeris.sites[id], el = e.sun_el[i0], margin = el - maskAt(sites[id].horizon, e.sun_az[i0]);
  const deg = (x) => `${x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)}°`;
  col.q(".sunline").textContent = `At landing: Sun at ${deg(el)} elevation, ${deg(Math.abs(margin))} ${margin >= 0 ? "above" : "below"} the skyline`;
  const d = verdictDelay(v, iPlanned);
  col.q(".verdict").textContent =
    d === null ? `Holds through a ${MAX_DELAY_D}-day delay` : d === 0 ? "Under half sunlight even on time" : `Falls below half sunlight with a ${d}-day delay`;
  const nums = [["Longest dark gap", dur(m.darkGap)], nextEvent(m)];
  col.q(".nums").innerHTML = nums.map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`).join("");
  col.q(".timeline").innerHTML = timeline(v, i0);
  col.q(".pano").innerHTML = panorama(sites[id].horizon, data.ephemeris.sites[id], i0, yr);
}

const plannedIndex = () => (Date.parse(state.date + "T00:00:00Z") - t0) / H;
const landingIndex = () => plannedIndex() + state.delay * 24;

function render() {
  const iPlanned = plannedIndex(), i0 = landingIndex();
  const when = fmtDate(t0 + i0 * H, { weekday: "short", year: "numeric" });
  const n = Math.abs(state.delay), days = `${n} day${n === 1 ? "" : "s"}`;
  $("#delay-out").textContent = state.delay === 0 ? `On time · lands ${when}` : `${state.delay > 0 ? "+" : "−"}${days} · lands ${when}`;
  const yr = yRange(state.picks);
  cols.forEach((col, c) => renderCol(col, state.picks[c], i0, iPlanned, yr));
  cancelAnimationFrame(mapFrame); // the map takes ~0.1 s: draw once per frame while the slider moves
  mapFrame = requestAnimationFrame(() => drawMap(i0, when));
}

// --- validation table: Science writes src/validation.json; null = not measured yet
function renderValidation() {
  const v = validation, done = v.rows.filter((r) => r.max_del_deg != null && r.max_daz_cos_deg != null);
  // Two significant figures however small (Horizons agreement is ~0.00003 deg; 4 decimals would print 0).
  const f = (x) => (x == null ? "–" : x === 0 ? "0°" : `${x.toFixed(Math.max(4, 1 - Math.floor(Math.log10(x))))}°`);
  $("#val-rows").innerHTML = v.rows.map((r) =>
    `<tr><td>${r.site}</td><td>${r.body}</td><td>${f(r.max_del_deg)}</td><td>${f(r.max_daz_cos_deg)}</td><td>${r.hours ?? "–"}</td><td>${r.start ? `${r.start} to ${r.stop}` : "–"}</td></tr>`).join("");
  const worst = Math.max(...done.flatMap((r) => [r.max_del_deg, r.max_daz_cos_deg]));
  $("#val-link").classList.toggle("ok", done.length > 0);
  $("#val-link").textContent = !done.length ? "Check vs NASA JPL Horizons: not yet run"
    : `✓ Within ${f(worst)} of NASA JPL Horizons${done.length < v.rows.length ? ` (${done.length} of ${v.rows.length} rows)` : ""}`;
  $("#val-link").title = done.length ? `Sun and Earth angles, worst of ${done.length} site and body rows; pass mark ${v.pass_deg}°` : "";
  $("#val-ref").textContent = `Reference: JPL Horizons, topocentric site on the Moon, airless, frame MOON_ME, correction LT+S. ${v.queried ? `Queried ${v.queried}.` : "Not yet queried."}`;
  $("#val-note").hidden = !!v.queried;
  $("#val-checks").innerHTML = v.checks.map((c) => `<li>${c.label} (${c.id}): ${c.result ?? "not yet run"}</li>`).join("");
}
renderValidation();

$("#foot").textContent = `Half sunlight = 360 of 720 hours. Verdicts test delays of 0 to ${MAX_DELAY_D} days from the planned date. Landing at 00:00 UTC. Mast height 2 m. Hover the charts for detail.`;
render();
