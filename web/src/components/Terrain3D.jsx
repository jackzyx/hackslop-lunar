import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createTerrain3D, cameraMatrix, eyeOf, hidden, project, EXAG } from "@/terrain/terrain-3d.js";
import { heightAt, mapView, toMap } from "@/terrain/shadow.js";
import { data, sites, sunAt, vis } from "@/lib/data.js";
import { siteLabel } from "@/lib/site-label.js";

const clampDist = d => Math.min(900, Math.max(15, d));

// Orbitable 3D terrain: same Sun vector and shadow shader as the 2D map, heights x EXAG.
export default function Terrain3D({ terrain, picks, i0, zoom, interacting }) {
  const mount = useRef(null), wrap = useRef(null), gfx = useRef(null), pointers = useRef(new Map());
  const [size, setSize] = useState(null); // CSS pixels
  const [failed, setFailed] = useState(false);
  const mapPicks = picks.filter(id => sites[id].terrain_modelled !== false);
  const sunSite = mapPicks[0] ?? "A";
  const viewKey = (zoom ? mapPicks.join(":") : "") + `|${zoom}`;
  const fresh = () => {
    const v = mapView(mapPicks.map(id => sites[id]), zoom && mapPicks.length > 0);
    return { key: viewKey, target: [v.cx, v.cy, (heightAt(terrain, v.cx, v.cy) || 0) * EXAG], yaw: 180, pitch: 38, dist: v.half * 2.6 };
  };
  const [cam, setCam] = useState(fresh);
  if (cam.key !== viewKey) setCam(fresh());

  useEffect(() => {
    const observer = new ResizeObserver(([e]) => { const { width, height } = e.contentRect; if (width > 0 && height > 0) setSize({ w: width, h: height }); });
    observer.observe(wrap.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    // A fresh canvas per mount: a disposed renderer loses its context for good.
    const c = document.createElement("canvas"), css = getComputedStyle(document.documentElement);
    mount.current.replaceChildren(c);
    setFailed(false);
    try { gfx.current = createTerrain3D(terrain, c, { amber: css.getPropertyValue("--primary").trim(), sun: css.getPropertyValue("--sun").trim() }); }
    catch { gfx.current = null; }
    if (!gfx.current) setFailed(true);
    const lost = () => setFailed(true);
    c.addEventListener("webglcontextlost", lost);
    return () => { c.removeEventListener("webglcontextlost", lost); gfx.current?.dispose(); gfx.current = null; c.remove(); };
  }, [terrain]);

  const mvp = size && cameraMatrix(cam, size.w / size.h);
  useEffect(() => {
    if (!mvp || !gfx.current) return;
    const dpr = Math.min(2, devicePixelRatio);
    const frame = requestAnimationFrame(() => gfx.current?.render({
      sun: sunAt(sunSite, i0), size: interacting ? 512 : 1000, mvp,
      width: Math.round(size.w * dpr), height: Math.round(size.h * dpr),
    }));
    return () => cancelAnimationFrame(frame);
  });

  const orbit = (dYaw, dPitch, scale = 1) => setCam(c => ({ ...c, yaw: (c.yaw + dYaw + 360) % 360, pitch: Math.min(88, Math.max(6, c.pitch + dPitch)), dist: clampDist(c.dist * scale) }));
  const onWheel = useEffectEvent(e => { e.preventDefault(); orbit(0, 0, Math.exp(Math.max(-100, Math.min(100, e.deltaY * (e.deltaMode ? 16 : 1))) * 0.002)); });
  useEffect(() => {
    const el = wrap.current, fn = e => onWheel(e);
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, []);

  function down(e) {
    if (e.button !== 0 || pointers.current.size >= 2) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  function move(e) {
    const p = pointers.current, prev = p.get(e.pointerId);
    if (!prev) return;
    const [a, b] = [...p.values()], before = b && Math.hypot(a.x - b.x, a.y - b.y);
    p.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (p.size === 2) { const [c, d] = [...p.values()]; orbit(0, 0, before / (Math.hypot(c.x - d.x, c.y - d.y) || before)); }
    else orbit(-(e.clientX - prev.x) * 0.4, (e.clientY - prev.y) * 0.3);
  }
  const up = e => pointers.current.delete(e.pointerId);
  function key(e) {
    const k = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 4], ArrowDown: [0, -4], "+": [0, 0, 0.85], "=": [0, 0, 0.85], "-": [0, 0, 1.18] }[e.key];
    if (k) { e.preventDefault(); orbit(...k); }
  }

  // Pins: the chosen sites (lit or dark at landing), custom sites, and the pole; none behind a ridge.
  const pins = [];
  if (mvp) {
    const eye = eyeOf(cam);
    const ground = (x, y) => { const p = [x, y, (heightAt(terrain, x, y) || 0) * EXAG]; return hidden(terrain, eye, p) ? null : project(mvp, p, size.w, size.h); };
    const at = (lat, lon) => ground(...toMap(lat, lon));
    const pole = ground(0, 0);
    if (pole) pins.push(<g key="pole" transform={`translate(${pole[0]},${pole[1]})`}><path className="cross" d="M-7,0h14M0,-7v14" /><text x="-9" y="14" textAnchor="end">POLE</text></g>);
    const pickX = picks.map(id => sites[id].terrain_modelled === false ? null : at(sites[id].lat, sites[id].lon)?.[0]);
    for (const s of data.sites) {
      const k = picks.indexOf(s.id);
      if (s.terrain_modelled === false || (k < 0 && !s.custom)) continue;
      const p = at(s.lat, s.lon);
      if (!p) continue;
      if (k < 0) { pins.push(<g key={s.id} transform={`translate(${p[0]},${p[1]})`}><path className="stem" d="M0,0v-12" /><circle className="pin-other" cy="-12" r="3" /><text x="6" y="-9">{s.id}</text></g>); continue; }
      const lit = vis(s.id).sun[i0] > 0, other = pickX[1 - k] ?? null;
      const side = other === null ? 0 : p[0] < other ? -1 : 1; // two picks: labels lean apart
      const label = siteLabel(s.name, k), wide = label.length * 7.2; // Geist Mono at 10.5 px measures 6.9 px a character
      const lx = side < 0 ? Math.max(wide + 6, p[0] - 10) : side > 0 ? Math.min(size.w - wide - 6, p[0] + 10) : Math.min(size.w - wide / 2 - 4, Math.max(wide / 2 + 4, p[0]));
      pins.push(<g key={s.id} transform={`translate(${p[0]},${p[1]})`}>
        <path className="stem" d="M0,0v-24" /><ellipse className="foot" rx="7" ry="3" />
        <circle className={lit ? "pin-lit" : "pin-dark"} cy="-24" r="5.5" />
        <text className="pin-label" x={lx - p[0]} y={side ? -21 : -36} textAnchor={side < 0 ? "end" : side > 0 ? "start" : "middle"} aria-label={`${label}${lit ? "" : " · SUN HIDDEN"}`}>{label}</text>
      </g>);
    }
  }

  return (
    <div ref={wrap} className="mapwrap terrain3d" tabIndex={0} role="application"
      aria-label={`3D view of the lunar south pole terrain, heights exaggerated ${EXAG} times. Drag or use arrow keys to orbit, scroll, pinch or plus and minus to zoom.`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onKeyDown={key}>
      <div ref={mount} className="shadow-surface" />
      {size && <svg viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">{pins}</svg>}
      {failed && <p className="map-hud terrain3d-msg">3D view needs WebGL 2. Switch back to 2D.</p>}
      <span className="map-hud br">LOLA 500 M · MOON_ME · HEIGHT ×{EXAG}</span>
    </div>
  );
}
