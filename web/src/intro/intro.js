// Solar-system approach aligned with the south-polar map.
import { mapView, mapViewport, toMap, R_KM } from "../terrain/shadow.js";
import { prepareIntroAssets, stopIntroAssetPreparation } from './intro-assets.js';
import { spherePixels } from './intro-pixels.js';
import { siteLabel } from '../lib/site-label.js';

const RAD = Math.PI / 180, AU = 149.6e6, MOON_DIST = 384400, R_SUN = 696000, R_EARTH = 6371;

// Sun's geocentric ecliptic longitude in deg (Astronomical Almanac low-precision formula, ~0.01 deg).
export function sunLongitude(ms) {
  const n = ms / 864e5 - 10957.5; // days from J2000.0, 2000-01-01 12:00 UTC
  const g = (357.528 + 0.9856003 * n) * RAD;
  return (((280.46 + 0.9856474 * n + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) % 360) + 360) % 360;
}

// Ecliptic positions in km, viewed from the south with Earth up; ignores orbit tilt.
export function scene(ms, sun) {
  const ls = sunLongitude(ms), ss = Math.atan2(sun[1], sun[0]) / RAD, up = ls - ss;
  const at = (lam, r) => [r * Math.sin((lam - up) * RAD), r * Math.cos((lam - up) * RAD)]; // clockwise from the south
  const earth = at(ls + 180, AU), m = at(ls + 180 - ss, MOON_DIST);
  return { sun: [0, 0], earth, moon: [earth[0] + m[0], earth[1] + m[1]] };
}

// Camera keyframes: [seconds, body to centre on, half the view in km].
const KEYS = [[0, "sun", 1.35 * AU], [2, "earth", 6.5e5], [3.6, "moon", 2600], [5.4, "landing", 170]];
const END = 7.8;
const LINES = [
  [0, (w) => `Plotting your landing: ${w}.`],
  [5.4, () => "Compare two sites. Shift the landing date."],
];

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
  const x = (t - t0) / (t1 - t0), e = x * x * (3 - 2 * x);
  const w = w0 * Math.pow(w1 / w0, e), f = (w - w1) / (w0 - w1); // log zoom; the target stays on screen
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
  fade.addColorStop(fadeRim === 'approach' ? 0.35 : 0.94, "#000");
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
export async function playIntro({ ms, sun, terrain, terrainReady, onLanding, picks, when, zoom = true, center }) {
  stopIntro?.();
  const el = document.querySelector("#intro"), layer = el.querySelector(".intro-scene");
  const cv = layer.querySelector("canvas"), g = cv.getContext("2d");
  const line = el.querySelector(".stars-line span"), skip = el.querySelector(".skip");
  const quality = introResolution(innerWidth, innerHeight, devicePixelRatio || 1);
  const pos = scene(ms, sun), T = 250;
  const view = { ...mapView(picks, zoom), ...center };
  const closeView = introTerrainView(view);
  quality.closeTerrain = Math.max(768, Math.min(1536, Math.ceil(768 * closeView.half / (view.half * 2))));
  pos.landing = [pos.moon[0] + view.cx, pos.moon[1] + view.cy];
  let moon = imageCanvas(spherePixels(sun, 256, null), 256), land, landApproach;
  let shownMoon, shownLand, shownClose, closeLand, terrainUnavailable = false, elapsed = 0;
  const stars = Array.from({ length: 220 }, () => [Math.random(), Math.random(), Math.random() < 0.1 ? 2 : 1, 0.2 + 0.6 * Math.random()]);
  el.hidden = false;

  let raf = 0, over = false, landing, sceneAnimation, snapshot, snapshotSource, layoutChanged, targetObserver, decorations;
  const markers = [], handoffAnimations = [];
  const clock = createIntroClock();
  const key = (ev) => {
    if (el.hidden || (ev.key !== "Escape" && (sceneAnimation || !["Enter", " "].includes(ev.key)))) return;
    ev.preventDefault();
    dismiss();
  };
  const finish = () => {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    removeEventListener("keydown", key);
    skip.onclick = null;
    stopIntro = undefined;
    el.hidden = true;
    el.dataset.phase = 'done';
    stopIntroAssetPreparation();
    sceneAnimation?.cancel();
    handoffAnimations.forEach(animation => animation.cancel());
    markers.forEach(marker => marker.remove());
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
      handoffAnimations.push(marker.animate([
        { left: marker.style.left, top: marker.style.top }, { left: `${x}px`, top: `${y}px` },
      ], timing));
      handoffAnimations.push(text.animate([
        { transform: text.style.transform, fontSize: '14px', letterSpacing: '0px' },
        { transform: `translate(${textBounds.left - x}px, ${textBounds.top - y}px)`, fontSize: `${parseFloat(style.fontSize) * scale}px`, letterSpacing: `${parseFloat(style.letterSpacing || 0) * scale || 0}px` },
      ], timing));
      const dot = marker.querySelector('i'), pinStyle = getComputedStyle(pin);
      handoffAnimations.push(dot.animate([
        { width: '12px', height: '12px', backgroundColor: AMBER, borderColor: '#000' },
        { width: `${11 * scale}px`, height: `${11 * scale}px`, backgroundColor: pinStyle.fill, borderColor: pinStyle.stroke },
      ], timing));
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
  addEventListener("keydown", key);
  skip.onclick = dismiss;
  stopIntro = finish;

  // HUD look (index.css): amber phosphor vectors and mono labels; Earth cyan; the Sun and Moon stay true.
  const MONO = "'Geist Mono Variable', ui-monospace, monospace", AMBER = "#ffb000";
  const label = (p, r, text) => {
    g.font = `500 13px ${MONO}`;
    g.fillStyle = "rgba(255,191,71,0.95)";
    g.fillText(text.toUpperCase(), p[0] + r + 8, p[1] + 5);
  };

  function draw(t) {
    const W = el.clientWidth, H = el.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(8e6 / (W * H)));
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingQuality = 'medium';
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    for (const [x, y, s, a] of stars) { g.fillStyle = `rgba(255,226,180,${a})`; g.fillRect(x * W, y * H, s, s); }

    const short = Math.min(W, H);
    const finalHalf = Math.min(introResolution(W, H).half, view.half * short / Math.max(W, H));
    const [[cx, cy], w] = camera(t, pos, finalHalf), k = short / 2 / w;
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
      const moonCrop = moon && clippedImage(moon.width, moon.height, pm[0] - rm, pm[1] - rm, 2 * rm, 2 * rm, W, H);
      if (moonCrop) g.drawImage(moon, ...moonCrop);
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
      if (rm < 120) label(pm, rm, "Moon");
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

    if (t > 4.8) {
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
        Object.assign(marker.style, { left: `${p[0]}px`, top: `${p[1]}px`, opacity: Math.min(1, (t - 4.8) / 0.6) });
        marker.querySelector('span').style.transform = `translate(-50%, ${p[1] <= pins[1 - index][1] ? '-34px' : '18px'})`;
      });
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
    line.textContent = cur[1](when);
    return 2 * view.half * k;
  }

  const tick = (now) => {
    // If an unusually slow connection has not delivered even preview terrain,
    // hold the lunar approach instead of revealing an empty surface or skipping it.
    const t = clock(now, document.hidden || (elapsed >= 3.4 && !land && !terrainUnavailable && Boolean(terrain || terrainReady)));
    elapsed = t;
    // Evaluate the large planner module only after the moving camera has landed.
    if (t >= 5.4 && !landing) loadLanding();
    const frame = Math.min(t, END);
    el.dataset.time = frame.toFixed(3);
    const size = draw(frame);
    if (frame >= 5.4 && land) {
      const liveCanvas = document.querySelector('#landing-terrain canvas[data-frame]');
      if (liveCanvas) placeTerrain(liveCanvas, el.clientWidth, el.clientHeight, size);
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
  await prepareIntroAssets({ terrain: readyTerrain, sun, quality, closeView, textureUrl: new URL('moon-albedo-4k.jpg', document.baseURI).href }, assets => {
    if (over) return;
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
