import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { createTerrain3D, cameraMatrix, eyeOf, hidden, panCamera, pickTerrain, project, terrainSurfaceHeight, EXAG } from "@/terrain/terrain-3d.js";
import { loadRegionalTerrain } from "@/terrain/regional-terrain.js";
import { heightAt, mapView, toMap } from "@/terrain/shadow.js";
import { data, sites, sunAt, vis } from "@/lib/data.js";
import { siteLabel } from "@/lib/site-label.js";
import { fromMap, MAX_POLE_KM } from "@/domain/custom-site.js";

export default function Terrain3D({ terrain, picks, i0, zoom, interacting, onGroundClick, onGroundContext, ask, dialog, keepCamera }) {
  const mount = useRef(null), wrap = useRef(null), gfx = useRef(null), pointers = useRef(new Map());
  const mouse = useRef(null);
  const cursor = useRef(null), cursorReset = useRef(null);
  const [pointer, setPointer] = useState(null);
  const [navigating, setNavigating] = useState(false);
  const [dragPanning, setDragPanning] = useState(false);
  const [shiftPanning, setShiftPanning] = useState(false);
  const [size, setSize] = useState(null); // CSS pixels
  const [failed, setFailed] = useState(false);
  const [regional, setRegional] = useState(null);
  const mapPicks = picks.filter(id => sites[id].terrain_modelled !== false);
  const sunSite = mapPicks[0] ?? "A";
  const viewKey = (zoom ? mapPicks.join(":") : "") + `|${zoom}`;
  const fresh = () => {
    const v = mapView(mapPicks.map(id => sites[id]), zoom && mapPicks.length > 0);
    return { key: viewKey, zoom, target: [v.cx, v.cy, (heightAt(terrain, v.cx, v.cy) || 0) * EXAG], yaw: 180, pitch: 38, dist: v.half * 2.6 };
  };
  const [cam, setCam] = useState(fresh);
  if (cam.key !== viewKey) {
    const placed = keepCamera.current;
    const site = sites[picks[1]];
    const matches = placed && site?.custom && Math.abs(site.lat - placed.lat) < 1e-6 && Math.abs(site.lon - placed.lon) < 1e-6;
    setCam(matches && cam.zoom === zoom ? { ...cam, key: viewKey } : fresh());
  }
  useEffect(() => { keepCamera.current = null; }, [keepCamera, picks[1]]);

  useEffect(() => {
    const observer = new ResizeObserver(([e]) => { const { width, height } = e.contentRect; if (width > 0 && height > 0) setSize({ w: width, h: height }); });
    observer.observe(mount.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    function shift(e) {
      if (e.key === "Shift" && mouse.current) setShiftPanning(e.shiftKey);
    }
    function blur() {
      mouse.current = null;
      setShiftPanning(false);
      cursor.current.hidden = true;
    }
    window.addEventListener("keydown", shift);
    window.addEventListener("keyup", shift);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", shift);
      window.removeEventListener("keyup", shift);
      window.removeEventListener("blur", blur);
      clearTimeout(cursorReset.current);
    };
  }, []);
  useEffect(() => {
    // A fresh canvas per mount: a disposed renderer loses its context for good.
    const c = document.createElement("canvas"), css = getComputedStyle(document.documentElement);
    mount.current.replaceChildren(c);
    setFailed(false);
    setRegional(null);
    try { gfx.current = createTerrain3D(terrain, c, {
      amber: css.getPropertyValue("--primary").trim(),
      sun: css.getPropertyValue("--sun").trim(),
      invalid: css.getPropertyValue("--critical").trim(),
    }); }
    catch { gfx.current = null; }
    const renderer = gfx.current;
    if (!renderer) setFailed(true);
    else loadRegionalTerrain().then(wide => {
      if (wide && gfx.current === renderer && renderer.extend(wide)) setRegional(wide);
    });
    const lost = () => setFailed(true);
    c.addEventListener("webglcontextlost", lost);
    return () => { c.removeEventListener("webglcontextlost", lost); gfx.current?.dispose(); gfx.current = null; c.remove(); };
  }, [terrain]);

  const mvp = useMemo(() => size && cameraMatrix(cam, size.w / size.h), [cam, size]);
  const orbit = (dYaw, dPitch, scale = 1) => setCam(c => ({
    ...c,
    yaw: (c.yaw + dYaw + 360) % 360,
    pitch: Math.min(88, Math.max(6, c.pitch + dPitch)),
    dist: Math.min(regional ? 1550 : 900, Math.max(15, c.dist * scale)),
  }));
  const pan = (dx, dy) => {
    if (size && (dx || dy)) setCam(c => panCamera(c, dx, dy, size.h, terrain, regional));
  };
  const onWheel = useEffectEvent(e => {
    if (e.target.closest(".map-ask")) return;
    e.preventDefault();
    orbit(0, 0, Math.exp(Math.max(-100, Math.min(100, e.deltaY * (e.deltaMode ? 16 : 1))) * 0.002));
  });
  useEffect(() => {
    const el = wrap.current, fn = e => onWheel(e);
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, []);

  function down(e) {
    if (e.pointerType === "mouse" && e.shiftKey && e.button === 0) return;
    const active = pointers.current;
    if ((e.button !== 0 && e.button !== 1) || active.size >= 2 || (active.size && e.pointerType !== "touch")) return;
    const rotates = e.button === 1 || e.pointerType === "touch";
    if (e.button === 1) e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    if (rotates) {
      setPointer(null);
      setNavigating(true);
    }
    for (const pointer of active.values()) pointer.dragged = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    active.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, rotates, dragged: active.size > 0 });
  }
  function move(e) {
    const p = pointers.current, prev = p.get(e.pointerId);
    if (e.pointerType === "mouse") {
      const last = mouse.current;
      mouse.current = { x: e.clientX, y: e.clientY };
      setShiftPanning(e.shiftKey);
      const pos = position(e);
      setPointer(pos);
      updateCursor(pos, last ? e.clientX - last.x : 0, last ? e.clientY - last.y : 0);
      if (e.shiftKey) {
        if (last) pan(e.clientX - last.x, e.clientY - last.y);
        if (prev) Object.assign(prev, { ...mouse.current, dragged: true });
        return;
      }
    }
    if (!prev) {
      if (e.pointerType === "pen") setPointer(position(e));
      return;
    }
    const [a, b] = [...p.values()], before = b && Math.hypot(a.x - b.x, a.y - b.y);
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    prev.x = e.clientX;
    prev.y = e.clientY;
    const pastThreshold = Math.hypot(prev.x - prev.startX, prev.y - prev.startY) > 5;
    if (!prev.dragged && pastThreshold) {
      prev.dragged = true;
      setPointer(null);
      setNavigating(true);
      setDragPanning(!prev.rotates);
    }
    if (p.size === 2) {
      const after = Math.hypot(a.x - b.x, a.y - b.y);
      pan(dx / 2, dy / 2);
      if (before > 0 && after > 0) orbit(0, 0, before / after);
    } else if (prev.rotates && (e.pointerType !== "touch" || prev.dragged)) orbit(-dx * 0.4, dy * 0.3);
    else if (!prev.rotates && prev.dragged) pan(dx, dy);
  }
  function updateCursor(pos, dx, dy) {
    const el = cursor.current;
    el.hidden = !pos;
    if (!pos) return;
    el.style.left = `${pos.x * 100}%`;
    el.style.top = `${pos.y * 100}%`;
    const scale = 4 / Math.max(6, Math.hypot(dx, dy));
    el.style.setProperty("--dot-x", `${dx * scale}px`);
    el.style.setProperty("--dot-y", `${dy * scale}px`);
    clearTimeout(cursorReset.current);
    cursorReset.current = setTimeout(() => {
      el.style.setProperty("--dot-x", "0px");
      el.style.setProperty("--dot-y", "0px");
    }, 80);
  }
  function position(e) {
    const bounds = mount.current.getBoundingClientRect();
    const x = (e.clientX - bounds.left) / bounds.width;
    const y = (e.clientY - bounds.top) / bounds.height;
    return x >= 0 && x < 1 && y >= 0 && y < 1 ? { x, y } : null;
  }
  function groundAt(pos) {
    if (!pos || !size || failed) return null;
    const world = pickTerrain(terrain, regional, cam, pos.x * 2 - 1, 1 - pos.y * 2, size.w / size.h, gfx.current?.regionalHeight);
    if (!world) return null;
    return { ...fromMap(world[0], world[1]), km: Math.hypot(world[0], world[1]), world, x: pos.x, y: pos.y };
  }
  function end(e) {
    const prev = pointers.current.get(e.pointerId);
    if (pointers.current.delete(e.pointerId) && !pointers.current.size) {
      setNavigating(false);
      setDragPanning(false);
    }
    return prev;
  }
  function up(e) {
    const prev = end(e);
    const pos = position(e);
    if (e.pointerType !== "touch") setPointer(pos);
    if (e.button === 0 && prev && !prev.dragged && Math.hypot(e.clientX - prev.startX, e.clientY - prev.startY) <= 5) {
      onGroundClick?.(ask ? null : groundAt(pos));
    }
  }
  function context(e) {
    if (!onGroundContext) return;
    e.preventDefault();
    if (pointers.current.size) return;
    const ground = groundAt(position(e));
    if (ground) onGroundContext(ground);
  }
  function key(e) {
    const shift = { ArrowLeft: [36, 0], ArrowRight: [-36, 0], ArrowUp: [0, 36], ArrowDown: [0, -36] }[e.key];
    if (e.shiftKey && shift) {
      e.preventDefault();
      pan(...shift);
      return;
    }
    const k = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 4], ArrowDown: [0, -4], "+": [0, 0, 0.85], "=": [0, 0, 0.85], "-": [0, 0, 1.18] }[e.key];
    if (k) { e.preventDefault(); orbit(...k); }
  }

  // Pins: the chosen sites (lit or dark at landing), custom sites, and the pole; none behind a ridge.
  const pins = [];
  const hover = useMemo(() => onGroundClick && !ask && !navigating && !shiftPanning ? groundAt(pointer) : null,
    [Boolean(onGroundClick), ask, navigating, shiftPanning, pointer, terrain, regional, cam, size, failed]);
  function worldAt(x, y) {
    const z = terrainSurfaceHeight(terrain, x, y);
    return [x, y, Number.isFinite(z) ? z : (heightAt(terrain, x, y) || 0) * EXAG];
  }
  const target = ask ?? hover;
  const markers = useMemo(() => {
    let selected = [...new Set(picks)].filter(id => sites[id].custom)
      .map(id => ({ world: worldAt(...toMap(sites[id].lat, sites[id].lon)) }));
    if (target) {
      selected = selected.filter(({ world }) => Math.hypot(world[0] - target.world[0], world[1] - target.world[1]) >= cam.dist * 0.007);
      selected.push({ world: target.world, bad: target.km > MAX_POLE_KM });
    }
    return selected;
  }, [picks, terrain, target, cam.dist]);
  useEffect(() => {
    if (!mvp || !gfx.current) return;
    const dpr = Math.min(2, devicePixelRatio);
    const frame = requestAnimationFrame(() => gfx.current?.render({
      sun: sunAt(sunSite, i0), size: interacting ? 512 : 1000, mvp, markers, eye: eyeOf(cam),
      width: Math.round(size.w * dpr), height: Math.round(size.h * dpr),
    }));
    return () => cancelAnimationFrame(frame);
  }, [mvp, size, sunSite, i0, interacting, regional, terrain, cam, markers]);
  if (mvp) {
    const eye = eyeOf(cam);
    const ground = world => hidden(terrain, eye, world) ? null : project(mvp, world, size.w, size.h);
    const at = (lat, lon) => ground(worldAt(...toMap(lat, lon)));
    const pole = ground(worldAt(0, 0));
    if (pole) pins.push(<g key="pole" transform={`translate(${pole[0]},${pole[1]})`}><path className="cross" d="M-7,0h14M0,-7v14" /><text x="-9" y="14" textAnchor="end">POLE</text></g>);
    const pickX = picks.map(id => sites[id].terrain_modelled === false ? null : at(sites[id].lat, sites[id].lon)?.[0]);
    for (const s of data.sites) {
      const k = picks.indexOf(s.id);
      if (s.terrain_modelled === false || (k < 0 && !s.custom)) continue;
      const world = worldAt(...toMap(s.lat, s.lon));
      const p = ground(world);
      if (!p) continue;
      if (k < 0) { pins.push(<g key={s.id} transform={`translate(${p[0]},${p[1]})`}><path className="stem" d="M0,0v-12" /><circle className="pin-other" cy="-12" r="3" /><text x="6" y="-9">{s.id}</text></g>); continue; }
      const lit = vis(s.id).sun[i0] > 0, other = pickX[1 - k] ?? null;
      const side = other === null ? 0 : p[0] < other ? -1 : 1; // two picks: labels lean apart
      const label = siteLabel(s.name, k), wide = label.length * 7.2; // Geist Mono at 10.5 px measures 6.9 px a character
      const lx = side < 0 ? Math.max(wide + 6, p[0] - 10) : side > 0 ? Math.min(size.w - wide - 6, p[0] + 10) : Math.min(size.w - wide / 2 - 4, Math.max(wide / 2 + 4, p[0]));
      pins.push(<g key={s.id} transform={`translate(${p[0]},${p[1]})`}>
        {!s.custom && <>
          <path className="stem" d="M0,0v-24" /><ellipse className="foot" rx="7" ry="3" />
          <circle className={lit ? "pin-lit" : "pin-dark"} cy="-24" r="5.5" />
        </>}
        <text className="pin-label" x={lx - p[0]} y={side ? -21 : -36} textAnchor={side < 0 ? "end" : side > 0 ? "start" : "middle"} aria-label={`${label}${lit ? "" : " · SUN HIDDEN"}`}>{label}</text>
      </g>);
    }
  }
  return (
    <div ref={wrap} className="mapwrap terrain3d" tabIndex={0} role="application"
      data-panning={dragPanning || shiftPanning || undefined}
      aria-label={`3D view of the lunar south pole terrain, heights exaggerated ${EXAG} times. Hold Shift and move the mouse, left-drag, or use Shift plus arrow keys to pan. Middle-drag or use arrow keys to orbit. Scroll, pinch or use plus and minus to zoom.`}
      onPointerEnter={e => { if (e.pointerType === "mouse") updateCursor(position(e), 0, 0); }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={() => {
        mouse.current = null;
        setPointer(null);
        setShiftPanning(false);
        updateCursor(null, 0, 0);
      }}
      onPointerCancel={end} onLostPointerCapture={end} onContextMenu={context}
      onAuxClick={e => { if (e.button === 1) e.preventDefault(); }} onKeyDown={key}>
      <div ref={mount} className="shadow-surface" />
      {size && <svg viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">{pins}</svg>}
      <div ref={cursor} className="terrain-cursor" hidden aria-hidden="true"><span /></div>
      {dialog}
      {failed && <p className="map-hud terrain3d-msg">3D view needs WebGL 2. Switch back to 2D.</p>}
      <span className="map-hud br">{regional ? "LOLA · REGIONAL RELIEF" : "LOLA 500 M · MOON_ME"} · HEIGHT ×{EXAG}</span>
    </div>
  );
}
