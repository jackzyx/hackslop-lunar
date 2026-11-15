// Solar-system approach aligned with the south-polar map.
import { mapView, mapViewport, toMap, R_KM } from "../terrain/shadow.js";
import { prepareIntroAssets, stopIntroAssetPreparation } from './intro-assets.js';
import { spherePixels } from './intro-pixels.js';
import { siteLabel } from '../lib/site-label.js';
import { LOCK_DELAY, HOLD, cameraProgress, reticleState, reticleCorners } from './reticle.js';
import { createStars, drawStars } from '../lib/starfield.js';

const AU = 149.6e6, R_SUN = 696000, R_EARTH = 6371;

// Camera keyframes: [seconds, body to centre on, half the view in km].
// The camera holds on the Moon for HOLD seconds while the south-pole lock-on plays (drawLock).
const LOCK_T = 3.6, LAND_T = 5.4 + HOLD;
const KEYS = [[0, "sun", 1.35 * AU], [2, "earth", 6.5e5], [LOCK_T, "moon", 2600], [LOCK_T + HOLD, "moon", 2600], [LAND_T, "landing", 170]];
const END = LAND_T + 0.8;
const LINES = [
  [0, (w) => `Plotting your landing: ${w}.`],
  [LOCK_T, () => "Locking on to the lunar south pole."],
  [LAND_T, () => "Compare two sites. Shift the landing date."],
];
const MONO_FONT = "'Geist Mono Variable', ui-monospace, monospace";

// Targeting HUD over the Moon's south pole (the disc centre: the scene is viewed from the south).
// A spinning crosshair decelerates onto the pole, rings counter-rotate, latitude circles sweep in, then a lock pulse.
function drawLock(g, t, P, R, k) {
  const fadeIn = smoothstep(LOCK_T - 0.3, LOCK_T + 0.1, t), fadeOut = 1 - smoothstep(LOCK_T + HOLD + 0.1, LOCK_T + HOLD + 0.6, t);
  const a = fadeIn * fadeOut;
  if (a <= 0) return;
  const lt = Math.min(1, Math.max(0, (t - LOCK_T) / HOLD)), lock = smoothstep(0.62, 0.78, lt);
  const amber = (al) => `rgba(255,176,0,${al * a})`;
  g.save();
  g.lineCap = "round";

  // Latitude circles on the polar disc, drawn on as a sweep.
  g.setLineDash([3, 5]);
  g.lineWidth = 1;
  g.font = `500 12px ${MONO_FONT}`;
  for (const [lat, i] of [[60, 0], [70, 1], [80, 2]]) {
    const r = Math.hypot(...toMap(-lat, 0)) * k, sweep = smoothstep(0.05 + i * 0.08, 0.4 + i * 0.08, lt) * 2 * Math.PI;
    if (r < 6 || sweep <= 0) continue;
    g.strokeStyle = amber(0.45);
    g.beginPath(); g.arc(P[0], P[1], r, -Math.PI / 2, -Math.PI / 2 + sweep); g.stroke();
    g.fillStyle = amber(0.8 * Math.min(1, sweep / Math.PI));
    g.fillText(`${lat}°S`, P[0] + 4, P[1] - r - 4);
  }
  g.setLineDash([]);

  // Two tick rings around the disc, rotating in opposite directions.
  const outer = R * 1.16, inner = R * 1.06, spinA = t * 0.7, spinB = -t * 1.6;
  g.strokeStyle = amber(0.55);
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i < 120; i++) {
    const th = spinA + i * Math.PI / 60, long = i % 10 === 0 ? 14 : i % 5 === 0 ? 8 : 4;
    g.moveTo(P[0] + Math.cos(th) * outer, P[1] + Math.sin(th) * outer);
    g.lineTo(P[0] + Math.cos(th) * (outer + long), P[1] + Math.sin(th) * (outer + long));
  }
  g.stroke();
  g.lineWidth = 2;
  g.strokeStyle = amber(0.85);
  for (let q = 0; q < 4; q++) {
    const th = spinB + q * Math.PI / 2;
    g.beginPath(); g.arc(P[0], P[1], inner, th + 0.12, th + Math.PI / 2 - 0.12); g.stroke();
  }

  // The crosshair: starts wide, spins 540 deg and decelerates as it closes onto the pole.
  const close = smoothstep(0, 0.7, lt), size = R * 0.85 + (34 - R * 0.85) * close, rot = (1 - close) * 3 * Math.PI;
  const flash = lock * (1 - smoothstep(0.78, 0.95, lt));
  g.strokeStyle = flash > 0.05 ? `rgba(255,${Math.round(176 + 79 * flash)},${Math.round(255 * flash)},${a})` : amber(1);
  g.lineWidth = 2;
  g.shadowColor = "rgba(255,176,0,0.8)"; g.shadowBlur = 10;
  g.beginPath();
  for (let q = 0; q < 4; q++) {
    const th = rot + q * Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
    g.moveTo(P[0] + c * size * 0.3, P[1] + s * size * 0.3); g.lineTo(P[0] + c * size, P[1] + s * size);
  }
  g.stroke();
  g.beginPath(); g.arc(P[0], P[1], size * 0.3, rot, rot + 1.5 * Math.PI); g.stroke();
  g.beginPath(); g.arc(P[0], P[1], 2.5, 0, 2 * Math.PI); g.fillStyle = amber(1); g.fill();
  g.shadowBlur = 0;

  // Lock pulse: two rings expanding from the pole.
  for (const delay of [0, 0.08]) {
    const p = Math.min(1, Math.max(0, (lt - 0.72 - delay) / 0.28));
    if (p <= 0 || p >= 1) continue;
    g.strokeStyle = amber(1 - p);
    g.lineWidth = 2;
    g.beginPath(); g.arc(P[0], P[1], 20 + p * R * 0.9, 0, 2 * Math.PI); g.stroke();
  }

  // Readout beside the crosshair.
  g.font = `600 16px ${MONO_FONT}`;
  g.fillStyle = amber(1);
  const x = P[0] + Math.max(size, 34) + 16, y = P[1] - 10;
  g.fillText(lock > 0.5 ? "LOCKED · LUNAR SOUTH POLE" : `ACQUIRING${".".repeat(1 + Math.floor(t * 6) % 3)}`, x, y);
  g.font = `500 13px ${MONO_FONT}`;
  g.fillStyle = amber(0.8);
  g.fillText(`LAT ${(90 * smoothstep(0, 0.7, lt)).toFixed(2)}°S`, x, y + 20);
  g.restore();
}

let earthImageReady;
function loadEarthImage() {
  return earthImageReady ??= (async () => {
    const image = new Image();
    image.decoding = 'async';
    image.src = new URL('earth-blue-marble.webp', document.baseURI).href;
    try { await image.decode(); return image; }
    catch { return null; }
  })();
}

export function introResolution(width, height, dpr = 1) {
  const short = Math.min(width, height), long = Math.max(width, height);
  return { sphere: Math.min(1536, Math.max(768, Math.ceil(short * dpr))),
    terrain: Math.min(1280, Math.max(800, Math.ceil(long * dpr))),
    half: Math.min(170, 230 / Math.hypot(1, long / short)) };
}

export function introTerrainView(view) {
  const available = Math.max(1, 248 - Math.max(Math.abs(view.cx), Math.abs(view.cy)));
  return { cx: view.cx, cy: view.cy, half: Math.min(view.half * 4, available) };
}

function camera(t, pos, finalHalf = 170) {
  const keys = KEYS.map((key, i) => i === KEYS.length - 1 ? [key[0], key[1], finalHalf] : key);
  const last = keys[keys.length - 1];
  if (t >= last[0]) return [pos[last[1]], last[2]];
  let k = 0;
  while (t >= keys[k + 1][0]) k++;
  const [t0, a, w0] = keys[k], [t1, b, w1] = keys[k + 1];
  const e = cameraProgress(t, t0, t1);
  const w = w0 * Math.pow(w1 / w0, e), f = w0 === w1 ? 1 - e : (w - w1) / (w0 - w1); // log zoom; the target stays on screen
  const A = pos[a], B = pos[b];
  return [[B[0] + (A[0] - B[0]) * f, B[1] + (A[1] - B[1]) * f], w];
}

// Real terrain around the pole (same shading as the map), faded out toward its rim.
function imageCanvas(pixels, n, fadeRim = false) {
  const cv = Object.assign(document.createElement("canvas"), { width: n, height: n });
  const c = cv.getContext("2d"), im = c.createImageData(n, n);
  im.data.set(pixels);
  c.putImageData(im, 0, 0);
  if (!fadeRim) return cv;
  const fade = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  // During approach use a broad feather; once terrain fills the viewport use a
  // narrow rim so the finished view retains its full contrast and detail.
  fade.addColorStop(fadeRim === 'approach' ? 0.35 : fadeRim === 'regional' ? 0.62 : 0.94, "#000");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  c.globalCompositeOperation = "destination-in";
  c.fillStyle = fade;
  c.fillRect(0, 0, n, n);
  return cv;
}

const smoothstep = (lo, hi, value) => {
  const x = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
  return x * x * (3 - 2 * x);
};

export function terrainBlend(radius, cx, cy, width, height, cameraHalf) {
  const corner = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy));
  return {
    opacity: smoothstep(0, 1, (1800 - cameraHalf) / 1200),
    detail: smoothstep(0.8, 1.08, radius / corner),
  };
}

// Advance by rendered time, not a wall-clock jump after a long task or tab switch.
export function createIntroClock() {
  let previous, time = 0;
  return (now, paused = false) => {
    if (previous !== undefined && !paused) time += Math.max(0, Math.min(50, now - previous)) / 1000;
    previous = now;
    return time;
  };
}

// During the close-up the projected sphere can be tens of thousands of pixels
// wide. Crop the source before drawing so resampling only covers the viewport.
export function clippedImage(imageWidth, imageHeight, x, y, width, height, viewportWidth, viewportHeight) {
  const left = Math.max(0, x), top = Math.max(0, y), right = Math.min(viewportWidth, x + width), bottom = Math.min(viewportHeight, y + height);
  if (right <= left || bottom <= top) return null;
  return [(left - x) * imageWidth / width, (top - y) * imageHeight / height,
    (right - left) * imageWidth / width, (bottom - top) * imageHeight / height,
    left, top, right - left, bottom - top];
}

export function terrainHandoff(width, height, size, target, aspect = 1) {
  const x = (width - size * aspect) / 2, y = (height - size) / 2;
  return {
    x, y,
    scaleX: target.width / (size * aspect),
    scaleY: target.height / size,
    tx: target.left - x,
    ty: target.top - y,
  };
}

let stopIntro;
export async function playIntro({ ms, sun, positions, terrain, terrainReady, onLanding, picks, when, zoom = true, center }) {
  stopIntro?.();
  const el = document.querySelector("#intro"), layer = el.querySelector(".intro-scene");
  el.dataset.epoch = new Date(ms).toISOString();
  const cv = layer.querySelector("canvas"), g = cv.getContext("2d");
  const line = el.querySelector(".intro-line span"), skip = el.querySelector(".skip");
  const quality = introResolution(innerWidth, innerHeight, devicePixelRatio || 1);
  const pos = { ...positions }, T = 250;
  const view = { ...mapView(picks, zoom), ...center };
  const closeView = introTerrainView(view);
  quality.closeTerrain = Math.max(768, Math.min(1536, Math.ceil(768 * closeView.half / (view.half * 2))));
  pos.landing = [pos.moon[0] + view.cx, pos.moon[1] + view.cy];
  let moon = imageCanvas(spherePixels(sun, 256, null), 256), earth, land, landApproach;
  let shownMoon, shownLand, shownClose, closeLand, shownWide, wideLand, wideHalf, wideReadyAt, terrainUnavailable = false, elapsed = 0;
  let assetVersion = 0, drawnVersion = -1, settled = false, drawnWidth = 0, drawnHeight = 0, drawnSize;
  const stars = createStars(220);
  el.hidden = false;

  let raf = 0, over = false, landing, sceneAnimation, snapshot, snapshotSource, layoutChanged, targetObserver, decorations;
  const markers = [], handoffAnimations = [];
  const reticle = document.createElement('div');
  reticle.className = 'intro-reticle';
  reticle.setAttribute('aria-hidden', 'true');
  const corners = Array.from({ length: 4 }, () => document.createElement('i'));
  reticle.append(...corners);
  el.append(reticle);
  const clock = createIntroClock();
  const key = (ev) => {
    if (el.hidden) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    dismiss();
  };
  const finish = () => {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    removeEventListener("keydown", key, true);
    skip.onclick = null;
    stopIntro = undefined;
    el.hidden = true;
    el.dataset.phase = 'done';
    stopIntroAssetPreparation();
    sceneAnimation?.cancel();
    handoffAnimations.forEach(animation => animation.cancel());
    markers.forEach(marker => marker.remove());
    reticle.remove();
    decorations?.remove();
    snapshot?.remove();
    targetObserver?.disconnect();
    if (layoutChanged) {
      removeEventListener("scroll", layoutChanged);
      removeEventListener("resize", layoutChanged);
    }
  };
  const loadLanding = () => landing ??= Promise.resolve().then(onLanding).catch(finish);
  const dismiss = () => {
    finish();
    if (onLanding) loadLanding();
  };
  const placeTerrain = (source, width, height, size) => {
    const aspect = source.width / source.height;
    const actualHalf = mapViewport(view, aspect, zoom).half;
    const shownHeight = size * actualHalf / view.half, shownWidth = shownHeight * aspect;
    if (!snapshot) {
      snapshot = document.createElement('canvas');
      snapshot.className = 'intro-terrain-copy';
      layer.append(snapshot);
    }
    if (source !== snapshotSource || source.dataset.frame !== snapshot.dataset.frame ||
        source.width !== snapshot.width || source.height !== snapshot.height) {
      snapshot.width = source.width;
      snapshot.height = source.height;
      snapshot.dataset.frame = source.dataset.frame;
      snapshot.getContext('2d', { alpha: false }).drawImage(source, 0, 0);
      snapshotSource = source;
    }
    Object.assign(snapshot.style, {
      left: `${(width - shownWidth) / 2}px`, top: `${(height - shownHeight) / 2}px`,
      width: `${shownWidth}px`, height: `${shownHeight}px`,
    });
    return shownHeight;
  };
  const reveal = () => {
    if (over) return;
    if (el.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }
    const surface = document.getElementById('landing-terrain');
    const liveCanvas = surface?.querySelector('canvas');
    if (!surface || surface.dataset.terrainError === 'true' || liveCanvas?.dataset.renderError === 'true') {
      finish();
      return;
    }
    if (!liveCanvas?.hasAttribute('data-frame')) {
      raf = requestAnimationFrame(reveal);
      return;
    }
    const W = el.clientWidth, H = el.clientHeight;
    let target = surface.getBoundingClientRect();
    if (target.top < 0 || target.bottom > H) {
      surface.scrollIntoView({ block: 'center', behavior: 'instant' });
      target = surface.getBoundingClientRect();
    }
    if (!target.width || !target.height) {
      raf = requestAnimationFrame(reveal);
      return;
    }
    const size = draw(END);
    const shownHeight = placeTerrain(liveCanvas, W, H, size);
    const map = surface.parentElement.querySelector('svg');
    const labels = [...(map?.querySelectorAll('.pin-label') ?? [])];
    const pins = [...(map?.querySelectorAll('.pin-lit, .pin-dark') ?? [])];
    const timing = { duration: 850, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' };
    markers.forEach((marker, index) => {
      const label = labels.find(node => Number(node.dataset.siteIndex) === index);
      const pin = pins.find(node => Number(node.dataset.siteIndex) === index);
      if (!label || !pin) return;
      const bounds = pin.getBoundingClientRect(), textBounds = label.getBoundingClientRect();
      const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
      const scale = map.getBoundingClientRect().height / map.viewBox.baseVal.height;
      const style = getComputedStyle(label), text = marker.querySelector('span');
      const textStart = text.getBoundingClientRect();
      const startX = parseFloat(marker.style.left), startY = parseFloat(marker.style.top);
      const fontSize = parseFloat(style.fontSize) * scale;
      text.style.fontSize = `${fontSize}px`;
      text.style.letterSpacing = `${parseFloat(style.letterSpacing || 0) * scale || 0}px`;
      handoffAnimations.push(marker.animate([
        { transform: 'translate3d(0, 0, 0)' }, { transform: `translate3d(${x - startX}px, ${y - startY}px, 0)` },
      ], timing));
      handoffAnimations.push(text.animate([
        { transform: `translate(${textStart.left - startX}px, ${textStart.top - startY}px) scale(${14 / fontSize})` },
        { transform: `translate(${textBounds.left - x}px, ${textBounds.top - y}px) scale(1)` },
      ], timing));
      const dot = marker.querySelector('i'), pinStyle = getComputedStyle(pin);
      dot.style.width = dot.style.height = `${11 * scale}px`;
      handoffAnimations.push(dot.animate([
        { transform: `translate(-50%, -50%) scale(${12 / (11 * scale)})`, backgroundColor: AMBER, borderColor: '#000' },
        { transform: 'translate(-50%, -50%) scale(1)', backgroundColor: pinStyle.fill, borderColor: pinStyle.stroke },
      ], timing));
      corners.forEach((corner, part) => {
        if (part % 2 !== index) return;
        const sx = part === 0 || part === 3 ? -1 : 1, sy = part < 2 ? -1 : 1;
        const endX = x + sx * 13 * scale - (sx > 0 ? 12 : 0);
        const endY = y + sy * 13 * scale - (sy > 0 ? 12 : 0);
        handoffAnimations.push(corner.animate([
          { transform: corner.style.transform, opacity: 1 },
          { transform: `translate3d(${endX}px, ${endY}px, 0)`, opacity: 1 },
        ], timing));
      });
    });
    if (map) {
      decorations = document.createElement('div');
      decorations.className = 'mapwrap intro-map-decorations';
      Object.assign(decorations.style, { left: `${target.left}px`, top: `${target.top}px`, width: `${target.width}px`, height: `${target.height}px` });
      const overlay = map.cloneNode(true);
      overlay.querySelectorAll('.pin-label, .pin-lit, .pin-dark').forEach(node => node.remove());
      decorations.append(overlay);
      el.append(decorations);
      handoffAnimations.push(decorations.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 650, fill: 'both' }));
    }
    const transformTo = (rect) => {
      const { scaleX, scaleY, tx, ty } = terrainHandoff(W, H, shownHeight, rect, liveCanvas.width / liveCanvas.height);
      return { transform: ['translate(0px, 0px) scale(1, 1)', `translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})`] };
    };
    layoutChanged = () => {
      const current = surface.getBoundingClientRect();
      if (current.width && current.height) sceneAnimation.effect.setKeyframes(transformTo(current));
    };
    el.dataset.phase = 'revealing';
    sceneAnimation = snapshot.animate(transformTo(target), timing);
    Promise.all([sceneAnimation.finished, ...handoffAnimations.map(animation => animation.finished)]).then(finish).catch(() => {});
    addEventListener("scroll", layoutChanged);
    addEventListener("resize", layoutChanged);
    targetObserver = new ResizeObserver(layoutChanged);
    targetObserver.observe(surface);
  };
  addEventListener("keydown", key, true);
  skip.onclick = dismiss;
  stopIntro = finish;
  loadEarthImage().then(image => {
    if (over || !image) return;
    earth = image;
    el.dataset.earth = 'nasa-blue-marble';
    assetVersion++;
  });

  // HUD look (index.css): amber phosphor vectors and mono labels; Earth cyan; the Sun and Moon stay true.
  const MONO = "'Geist Mono Variable', ui-monospace, monospace", AMBER = "#ffb000";
  const label = (p, r, text, gap = 8) => {
    g.font = `500 13px ${MONO}`;
    g.fillStyle = "rgba(255,191,71,0.95)";
    g.fillText(text.toUpperCase(), p[0] + r + gap, p[1] + 5);
  };

  function draw(t) {
    const W = el.clientWidth, H = el.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(8e6 / (W * H)));
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingQuality = 'medium';
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    drawStars(g, stars, W, H, t * 2);

    const short = Math.min(W, H);
    const finalHalf = Math.min(introResolution(W, H).half, view.half * short / Math.max(W, H));
    const [[cx, cy], w] = camera(t, pos, finalHalf), k = short / 2 / w;
    const S = ([x, y]) => [W / 2 + (x - cx) * k, H / 2 - (y - cy) * k];
    const on = ([x, y], m) => x > -m && x < W + m && y > -m && y < H + m;

    g.lineWidth = 1;
    for (const [c, r] of [[pos.sun, Math.hypot(...pos.earth)], [pos.earth, Math.hypot(pos.moon[0] - pos.earth[0], pos.moon[1] - pos.earth[1])]]) {
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

    const moonFocus = smoothstep(2 + LOCK_DELAY, 2 + LOCK_DELAY + .12, t);
    const earthLabelAlpha = 1 - smoothstep(2 + LOCK_DELAY - .12, 2 + LOCK_DELAY, t);
    const pe = S(pos.earth), re = Math.max(R_EARTH * k, 18);
    if (on(pe, re)) {
      if (earth) {
        g.save();
        g.beginPath(); g.arc(pe[0], pe[1], re, 0, 2 * Math.PI); g.clip();
        g.drawImage(earth, pe[0] - re, pe[1] - re, 2 * re, 2 * re);
        g.restore();
      } else {
        g.fillStyle = "#38d4ff";
        g.beginPath(); g.arc(pe[0], pe[1], re, 0, 2 * Math.PI); g.fill();
      }
      const phi = Math.atan2(pos.earth[1], -pos.earth[0]); // toward the Sun, canvas angle
      g.fillStyle = "rgba(0,0,0,0.78)";
      g.beginPath(); g.arc(pe[0], pe[1], re, phi + Math.PI / 2, phi + 1.5 * Math.PI); g.closePath(); g.fill();
      if (re < 120 && earthLabelAlpha > 0) {
        g.globalAlpha = earthLabelAlpha;
        label(pe, re, "Earth");
        g.globalAlpha = 1;
      }
    }

    const pm = S(pos.moon), rm = Math.max(R_KM * k, 2.5);
    if (on(pm, rm)) {
      const moonCrop = moon && clippedImage(moon.width, moon.height, pm[0] - rm, pm[1] - rm, 2 * rm, 2 * rm, W, H);
      if (moonCrop) g.drawImage(moon, ...moonCrop);
      if (wideLand) {
        const radius = wideHalf * k;
        const crop = clippedImage(wideLand.width, wideLand.height, pm[0] - radius, pm[1] - radius, 2 * radius, 2 * radius, W, H);
        if (crop) {
          g.globalAlpha = smoothstep(0, 1, (3000 - w) / 1800) * smoothstep(0, 650, performance.now() - wideReadyAt);
          g.drawImage(wideLand, ...crop);
          g.globalAlpha = 1;
        }
      }
      const blend = terrainBlend(T * k, pm[0], pm[1], W, H, w);
      if (land && blend.opacity > 0) {
        const crop = clippedImage(land.width, land.height, pm[0] - T * k, pm[1] - T * k, 2 * T * k, 2 * T * k, W, H);
        if (crop) {
          // Keep the edge soft while the tile is visibly surrounded by globe.
          g.globalAlpha = blend.opacity;
          g.drawImage(landApproach, ...crop);
          if (blend.detail > 0) {
            g.globalAlpha = blend.opacity * blend.detail;
            g.drawImage(land, ...crop);
          }
        }
        g.globalAlpha = 1;
      }
      const moonLabelAlpha = moonFocus;
      if (rm < 120 && moonLabelAlpha > 0) {
        g.globalAlpha = moonLabelAlpha;
        label(pm, rm, "Moon", 28);
        g.globalAlpha = 1;
      }
    }

    if (closeLand) {
      const p = S(pos.landing), radius = closeView.half * k;
      const blend = terrainBlend(radius, p[0], p[1], W, H, w);
      const crop = clippedImage(closeLand.width, closeLand.height, p[0] - radius, p[1] - radius, 2 * radius, 2 * radius, W, H);
      if (crop) {
        // The detail tile replaces the overview throughout its opaque interior.
        // Feather only its outer rim; a broad approach mask lets blur show through.
        g.globalAlpha = blend.opacity;
        g.drawImage(closeLand, ...crop);
        g.globalAlpha = 1;
      }
    }

    drawLock(g, t, pm, rm, k);

    if (t > 4.8 + HOLD) {
      const pins = picks.map(site => { const [x, y] = toMap(site.lat, site.lon); return S([pos.moon[0] + x, pos.moon[1] + y]); });
      pins.forEach((p, index) => {
        if (!markers[index]) {
          const marker = document.createElement('div');
          marker.className = 'intro-site-marker';
          marker.append(document.createElement('i'), document.createElement('span'));
          marker.querySelector('span').textContent = siteLabel(picks[index].name, index);
          el.append(marker); markers[index] = marker;
        }
        const marker = markers[index];
        Object.assign(marker.style, { left: `${p[0]}px`, top: `${p[1]}px`, opacity: Math.min(1, (t - 4.8 - HOLD) / 0.6) });
        marker.querySelector('span').style.transform = `translate(-50%, ${p[1] <= pins[1 - index][1] ? '-34px' : '18px'})`;
      });
    }

    const aim = reticleState(t, { sun: ps, earth: pe, moon: pm, landing: S(pos.landing) }, { earth: re, moon: rm, landing: 24 });
    const sitePoints = picks.map(site => { const [x, y] = toMap(site.lat, site.lon); return S([pos.moon[0] + x, pos.moon[1] + y]); });
    reticle.dataset.state = aim.split > 0 ? 'split' : aim.locked ? 'locked' : 'acquiring';
    reticle.dataset.target = aim.target;
    reticleCorners(aim, sitePoints).forEach((point, index) => {
      corners[index].style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
    });

    let cur = LINES[0];
    for (const l of LINES) if (t >= l[0]) cur = l;
    const caption = cur[1](when);
    if (line.textContent !== caption) line.textContent = caption;
    return 2 * view.half * k;
  }

  const tick = (now) => {
    // If an unusually slow connection has not delivered even preview terrain,
    // hold the lunar approach instead of revealing an empty surface or skipping it.
    const t = clock(now, document.hidden || (elapsed >= LOCK_T + HOLD - 0.2 && !land && !terrainUnavailable && Boolean(terrain || terrainReady)));
    elapsed = t;
    // Evaluate the large planner module only after the moving camera has landed.
    if (t >= LAND_T && !landing) loadLanding();
    const frame = Math.min(t, END);
    el.dataset.time = frame.toFixed(3);
    if (frame < LAND_T || !settled || drawnVersion !== assetVersion || (wideLand && now - wideReadyAt < 700) || drawnWidth !== el.clientWidth || drawnHeight !== el.clientHeight) {
      drawnSize = draw(frame);
      settled = frame >= LAND_T;
      drawnVersion = assetVersion;
      drawnWidth = el.clientWidth; drawnHeight = el.clientHeight;
    }
    if (frame >= LAND_T && land) {
      const liveCanvas = document.querySelector('#landing-terrain canvas[data-frame]');
      if (liveCanvas) placeTerrain(liveCanvas, el.clientWidth, el.clientHeight, drawnSize);
    }
    if (t >= END) loadLanding().then(reveal);
    else raf = requestAnimationFrame(tick);
  };
  el.dataset.phase = 'playing';
  el.dataset.assets = 'loading';
  draw(0);
  document.getElementById('intro-boot')?.setAttribute('hidden', '');
  raf = requestAnimationFrame(tick);
  const readyTerrain = terrainReady ? await terrainReady : terrain;
  if (over) return;
  await prepareIntroAssets({ terrain: readyTerrain, sun, quality, closeView, textureUrl: new URL('moon-albedo-4k.jpg', document.baseURI).href, approachUrl: new URL('terrain_approach_1500m.bin', document.baseURI).href }, assets => {
    if (over) return;
    assetVersion++;
    if (assets.wide && assets.wide !== shownWide) {
      wideLand = imageCanvas(assets.wide, assets.wideN, 'regional');
      wideHalf = assets.wideHalf;
      wideReadyAt = performance.now();
      shownWide = assets.wide;
      el.dataset.regionalSpan = String(wideHalf * 2);
    }
    if (assets.moon && assets.moon !== shownMoon) { moon = imageCanvas(assets.moon, assets.moonN); shownMoon = assets.moon; }
    if (assets.land && assets.land !== shownLand) {
      landApproach = imageCanvas(assets.land, assets.landN, 'approach');
      land = imageCanvas(assets.land, assets.landN, true);
      shownLand = assets.land;
    }
    if (assets.complete && !assets.land) terrainUnavailable = true;
    if (assets.close && assets.close !== shownClose) {
      closeLand = imageCanvas(assets.close, assets.closeN, true);
      shownClose = assets.close;
      el.dataset.closeResolution = String(assets.closeN);
    }
    el.dataset.assets = assets.stage;
  });
}
