// STARS intro: one zoom from the inner solar system down to the landing region, for the landing
// instant. Seen from the south, like the polar map, so the last frame lines up with it: 0 deg
// longitude (Earth-facing) up, 90 E right. Positions come from the landing date and the same Sun
// vector the shadow map uses. Sizes and distances are true at every zoom level.
import { shadeView, paint, toMap, R_KM } from "./shadow.js";

const RAD = Math.PI / 180, AU = 149.6e6, MOON_DIST = 384400, R_SUN = 696000, R_EARTH = 6371;

// Sun's geocentric ecliptic longitude in deg (Astronomical Almanac low-precision formula, ~0.01 deg).
export function sunLongitude(ms) {
  const n = ms / 864e5 - 10957.5; // days from J2000.0, 2000-01-01 12:00 UTC
  const g = (357.528 + 0.9856003 * n) * RAD;
  return (((280.46 + 0.9856474 * n + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) % 360) + 360) % 360;
}

// Sun, Earth, Moon on the ecliptic plane (km; x right, y up on screen), seen from the south and
// turned so the Moon->Earth direction points up. The Moon's place on its orbit comes from the
// sub-solar longitude (180 = new Moon, 0 = full). shortcut: ignores the 5 deg orbit tilt.
export function scene(ms, sun) {
  const ls = sunLongitude(ms), ss = Math.atan2(sun[1], sun[0]) / RAD, up = ls - ss;
  const at = (lam, r) => [r * Math.sin((lam - up) * RAD), r * Math.cos((lam - up) * RAD)]; // clockwise from the south
  const earth = at(ls + 180, AU), m = at(ls + 180 - ss, MOON_DIST);
  return { sun: [0, 0], earth, moon: [earth[0] + m[0], earth[1] + m[1]] };
}

// Camera keyframes: [seconds, body to centre on, half the view in km].
const KEYS = [[0, "sun", 1.35 * AU], [2, "earth", 6.5e5], [3.6, "moon", 2600], [5.4, "moon", 170]];
const END = 7.8;
const LINES = [
  [0, (w) => `Plotting your landing: ${w}.`],
  [1.8, () => "Earth, and the Moon where it will be that day."],
  [3.4, () => "The Moon from below its south pole, lit as it will be."],
  [4.6, () => "The south pole. Here the Sun only skims the horizon."],
  [5.6, () => "Real NASA terrain, shadows at landing. Now pick two sites and slip the date."],
];

export function introResolution(width, height, dpr = 1) {
  const short = Math.min(width, height), long = Math.max(width, height);
  return { sphere: Math.min(1536, Math.max(768, Math.ceil(short * dpr))),
    terrain: Math.min(1280, Math.max(800, Math.ceil(long * dpr))),
    half: Math.min(170, 230 / Math.hypot(1, long / short)) };
}

function camera(t, pos, finalHalf = 170) {
  const keys = KEYS.map((key, i) => i === KEYS.length - 1 ? [key[0], key[1], finalHalf] : key);
  const last = keys[keys.length - 1];
  if (t >= last[0]) return [pos[last[1]], last[2]];
  let k = 0;
  while (t >= keys[k + 1][0]) k++;
  const [t0, a, w0] = keys[k], [t1, b, w1] = keys[k + 1];
  const x = (t - t0) / (t1 - t0), e = x * x * (3 - 2 * x);
  const w = w0 * Math.pow(w1 / w0, e), f = (w - w1) / (w0 - w1); // log zoom; the target stays on screen
  const A = pos[a], B = pos[b];
  return [[B[0] + (A[0] - B[0]) * f, B[1] + (A[1] - B[1]) * f], w];
}

// The Moon as a lit sphere seen from below its south pole (screen up = lon 0, right = 90 E).
let texturePromise;
function loadMoonTexture() {
  return texturePromise ??= new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    image.onerror = () => resolve(null); // The intro still works if the optional visual asset is missing.
    image.src = new URL('moon-albedo-4k.jpg', document.baseURI).href;
  });
}

function sphere(sun, n, texture) {
  const cv = Object.assign(document.createElement("canvas"), { width: n, height: n });
  const c = cv.getContext("2d"), im = c.createImageData(n, n), b = new Float32Array(n * n).fill(NaN);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const u = (2 * i + 1) / n - 1, v = 1 - (2 * j + 1) / n, rr = u * u + v * v;
      if (rr <= 1) b[j * n + i] = 0.04 + 0.96 * Math.max(0, v * sun[0] + u * sun[1] - Math.sqrt(1 - rr) * sun[2]) ** 0.7;
    }
  }
  paint(b, im.data);
  if (texture) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u = (2 * i + 1) / n - 1, v = 1 - (2 * j + 1) / n, rr = u * u + v * v;
    if (rr > 1) continue;
    // Orthographic view from south: longitude 0 up, 90 E right, matching the map.
    const lon = Math.atan2(u, v), lat = -Math.acos(Math.sqrt(rr));
    const tx = Math.min(texture.width - 1, Math.floor((lon / (2 * Math.PI) + 0.5) * texture.width));
    const ty = Math.min(texture.height - 1, Math.floor((0.5 - lat / Math.PI) * texture.height));
    const a = 4 * (ty * texture.width + tx), o = 4 * (j * n + i);
    for (let channel = 0; channel < 3; channel++) im.data[o + channel] = texture.data[a + channel] * (0.12 + 1.25 * b[j * n + i]);
  }
  c.putImageData(im, 0, 0);
  return cv;
}

// Real terrain around the pole (same shading as the map), faded out toward its rim.
function terrainImage(terrain, sun, half, n) {
  const cv = Object.assign(document.createElement("canvas"), { width: n, height: n });
  const c = cv.getContext("2d"), im = c.createImageData(n, n);
  paint(shadeView(terrain, sun, { cx: 0, cy: 0, half }, n), im.data);
  c.putImageData(im, 0, 0);
  const fade = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  // Only soften the outer edge, outside the final camera view. The old circular
  // fade erased most of the visible terrain on wide screens.
  fade.addColorStop(0.94, "#000"); fade.addColorStop(1, "rgba(0,0,0,0)");
  c.globalCompositeOperation = "destination-in";
  c.fillStyle = fade;
  c.fillRect(0, 0, n, n);
  return cv;
}

let hideTimer = 0, run = 0, stopIntro;
export async function playIntro({ ms, sun, terrain, picks, when }) {
  const thisRun = ++run;
  stopIntro?.();
  const el = document.querySelector("#intro"), cv = el.querySelector("canvas"), g = cv.getContext("2d");
  const line = el.querySelector(".stars-line span"), skip = el.querySelector(".skip");
  const quality = introResolution(innerWidth, innerHeight, devicePixelRatio || 1);
  const texture = await loadMoonTexture();
  if (thisRun !== run) return;
  const pos = scene(ms, sun), moon = sphere(sun, quality.sphere, texture), T = 250;
  const land = terrain && terrainImage(terrain, sun, T, quality.terrain);
  const stars = Array.from({ length: 220 }, () => [Math.random(), Math.random(), Math.random() < 0.1 ? 2 : 1, 0.2 + 0.6 * Math.random()]);
  clearTimeout(hideTimer);
  el.hidden = false;
  el.classList.remove("done");

  let start = 0, raf = 0, over = false;
  const key = (ev) => { if (["Escape", "Enter", " "].includes(ev.key)) { ev.preventDefault(); finish(); } };
  const finish = () => {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    removeEventListener("keydown", key);
    el.classList.add("done");
    hideTimer = setTimeout(() => (el.hidden = true), 500);
  };
  addEventListener("keydown", key);
  skip.onclick = finish;
  stopIntro = finish;

  // HUD look (index.css): amber phosphor vectors and mono labels; Earth cyan; the Sun and Moon stay true.
  const MONO = "'Geist Mono Variable', ui-monospace, monospace", AMBER = "#ffb000";
  const label = (p, r, text) => {
    g.font = `500 13px ${MONO}`;
    g.fillStyle = "rgba(255,191,71,0.95)";
    g.fillText(text.toUpperCase(), p[0] + r + 8, p[1] + 5);
  };

  function draw(t) {
    const dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    for (const [x, y, s, a] of stars) { g.fillStyle = `rgba(255,226,180,${a})`; g.fillRect(x * W, y * H, s, s); }

    const [[cx, cy], w] = camera(t, pos, introResolution(W, H).half), k = Math.min(W, H) / 2 / w;
    const S = ([x, y]) => [W / 2 + (x - cx) * k, H / 2 - (y - cy) * k];
    const on = ([x, y], m) => x > -m && x < W + m && y > -m && y < H + m;

    g.lineWidth = 1;
    for (const [c, r] of [[pos.sun, AU], [pos.earth, MOON_DIST]]) {
      const R = r * k, p = S(c), a = 0.5 * Math.min(1, Math.max(0, (4 * Math.min(W, H) - R) / (3 * Math.min(W, H))));
      if (R < 12 || a <= 0) continue; // fade an orbit out before it turns into a straight line
      g.strokeStyle = `rgba(255,176,0,${a})`;
      g.beginPath(); g.arc(p[0], p[1], R, 0, 2 * Math.PI); g.stroke();
    }

    const ps = S(pos.sun);
    if (on(ps, 60)) {
      const r = Math.max(R_SUN * k, 9), glow = g.createRadialGradient(ps[0], ps[1], 0, ps[0], ps[1], r * 5);
      glow.addColorStop(0, "#fff6d8"); glow.addColorStop(0.2, "rgba(255,190,80,0.9)"); glow.addColorStop(1, "rgba(255,150,40,0)");
      g.fillStyle = glow;
      g.beginPath(); g.arc(ps[0], ps[1], r * 5, 0, 2 * Math.PI); g.fill();
      label(ps, r, "Sun");
    } else {
      // Sun off screen: mark its direction on the edge, so the lit side always has a reason.
      const dx = ps[0] - W / 2, dy = ps[1] - H / 2, f = Math.min((W / 2 - 50) / Math.abs(dx), (H / 2 - 40) / Math.abs(dy));
      const q = [W / 2 + dx * f, H / 2 + dy * f];
      g.fillStyle = AMBER;
      g.beginPath(); g.arc(q[0], q[1], 6, 0, 2 * Math.PI); g.fill();
      g.font = `500 13px ${MONO}`;
      g.textAlign = dx > 0 ? "right" : "left";
      g.fillText("SUN", q[0] + (dx > 0 ? -12 : 12), q[1] + 5);
      g.textAlign = "left";
    }

    const pe = S(pos.earth), re = Math.max(R_EARTH * k, 3.5);
    if (on(pe, re)) {
      g.fillStyle = "#38d4ff";
      g.beginPath(); g.arc(pe[0], pe[1], re, 0, 2 * Math.PI); g.fill();
      const phi = Math.atan2(pos.earth[1], -pos.earth[0]); // toward the Sun, canvas angle
      g.fillStyle = "rgba(0,0,0,0.78)";
      g.beginPath(); g.arc(pe[0], pe[1], re, phi + Math.PI / 2, phi + 1.5 * Math.PI); g.closePath(); g.fill();
      if (re < 120) label(pe, re, "Earth");
    }

    const pm = S(pos.moon), rm = Math.max(R_KM * k, 2.5);
    if (on(pm, rm)) {
      g.drawImage(moon, pm[0] - rm, pm[1] - rm, 2 * rm, 2 * rm);
      g.imageSmoothingQuality = 'high';
      const a = Math.min(1, Math.max(0, (1800 - w) / 1200));
      if (land && a > 0) {
        g.globalAlpha = a;
        g.drawImage(land, pm[0] - T * k, pm[1] - T * k, 2 * T * k, 2 * T * k);
        g.globalAlpha = 1;
      }
      if (rm < 120) label(pm, rm, "Moon");
    }

    if (t > 4.8) {
      g.globalAlpha = Math.min(1, (t - 4.8) / 0.6);
      const pins = picks.map((s) => { const [mx, my] = toMap(s.lat, s.lon); return [s.name, S([pos.moon[0] + mx, pos.moon[1] + my])]; });
      pins.sort((a, b) => a[1][0] - b[1][0]); // left pin labelled on its left, right pin on its right
      pins.forEach(([name, p], i) => {
        g.fillStyle = AMBER; g.strokeStyle = "#000"; g.lineWidth = 2;
        g.beginPath(); g.arc(p[0], p[1], 6, 0, 2 * Math.PI); g.fill(); g.stroke();
        g.lineWidth = 4; g.font = `600 14px ${MONO}`; g.textAlign = i ? "left" : "right";
        const x = p[0] + (i ? 14 : -14);
        g.fillStyle = "#ffd98a";
        g.strokeText(name.toUpperCase(), x, p[1] + 5); g.fillText(name.toUpperCase(), x, p[1] + 5);
      });
      g.textAlign = "left";
      g.globalAlpha = 1;
    }

    // Target reticle on the camera's aim point.
    g.strokeStyle = "rgba(255,176,0,0.55)"; g.lineWidth = 1.5;
    const c = [W / 2, H / 2], q = 46, l = 12;
    g.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      g.moveTo(c[0] + sx * q, c[1] + sy * (q - l)); g.lineTo(c[0] + sx * q, c[1] + sy * q); g.lineTo(c[0] + sx * (q - l), c[1] + sy * q);
    }
    g.stroke();

    let cur = LINES[0];
    for (const l of LINES) if (t >= l[0]) cur = l;
    line.textContent = cur[1](when).slice(0, Math.floor((t - cur[0]) * 45) + 1);
  }

  const tick = (now) => {
    start ||= now;
    const t = (now - start) / 1000;
    draw(Math.min(t, END));
    if (t >= END) finish();
    else raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
