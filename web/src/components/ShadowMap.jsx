import { useEffect, useEffectEvent, useRef, useState } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { createShadowRenderer } from "@/terrain/shadow-renderer.js";
import { sites, sunAt } from "@/lib/data.js";
import { mapView, mapViewport, MIN_MAP_HALF, transformMapViewport } from "@/terrain/shadow.js";
import { mapOverlay } from "@/lib/charts.js";
import { fromMap, poleKm, MAX_POLE_KM } from "@/domain/custom-site.js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Terrain3D from "@/components/Terrain3D";
import { EXAG } from "@/terrain/terrain-3d.js";

const MAP = 360; // canvas pixels; CSS scales it to the panel
const CENTER = { x: 0, y: 0 };

function gesture(pointers, bounds) {
  const [first, second = first] = pointers.values();
  const x = (first.x + second.x) / 2 - bounds.left;
  const y = (first.y + second.y) / 2 - bounds.top;
  return {
    x: (2 * x - bounds.width) / bounds.height,
    y: 1 - 2 * y / bounds.height,
    distance: Math.hypot(first.x - second.x, first.y - second.y),
  };
}

// Real terrain with the shadows at the landing instant (shadow.js), lon 0 up, 90 E right.
// The Sun direction comes from the first chosen site's row of the same table the cards use.
export default function ShadowMap({ picks, i0, when, zoom: closeUp, onZoom, terrain, terrainErr, interacting = false, onPlace }) {
  const wrapper = useRef(null), surface = useRef(null), renderer = useRef(null), down = useRef(null);
  const [hover, setHover] = useState(null); // live crosshair: svg position and the ground under it
  const [placeMsg, setPlaceMsg] = useState(null);
  const [ask, setAsk] = useState(null); // right-click dialog: the ground under the click
  const pointers = useRef(new Map());
  const [aspect, setAspect] = useState(null);
  const [px, setPx] = useState(512); // map height in device pixels: render sharp on any screen
  const [dragging, setDragging] = useState(false);
  const [wheeling, setWheeling] = useState(false);
  const [painted, setPainted] = useState(null);
  const [is3d, setIs3d] = useState(false);
  const mapPicks = picks.filter(id => sites[id].terrain_modelled !== false);
  const zoom = closeUp && mapPicks.length > 0;
  const sunSite = mapPicks[0] ?? "A";
  const viewKey = zoom ? mapPicks.join(":") : "";
  const [viewport, setViewport] = useState({ key: viewKey, view: null });
  if (viewport.key !== viewKey) setViewport({ key: viewKey, view: null });

  const base = mapView(mapPicks.map(id => sites[id]), zoom);
  const view = mapViewport(viewport.view ?? base, aspect ?? 1, zoom, terrain ?? undefined);
  const maxHalf = mapViewport({ ...base, half: Infinity }, aspect ?? 1, zoom, terrain ?? undefined).half;
  const preview = interacting || dragging || wheeling;
  const overlay = painted?.view ?? view;
  const mapWidth = MAP * overlay.aspect;
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) { setAspect(Math.round(width / height * 10000) / 10000); setPx(Math.min(2048, Math.max(256, Math.round(height * devicePixelRatio)))); }
    });
    observer.observe(surface.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!terrain) return;
    renderer.current = createShadowRenderer(terrain, surface.current, setPainted);
    return () => { renderer.current.dispose(); renderer.current = null; };
  }, [terrain]);
  useEffect(() => {
    if (aspect === null || is3d) return; // hidden behind the 3D view: skip the work
    renderer.current?.request({ sun: sunAt(sunSite, i0), view, size: preview ? Math.min(512, px) : px, interacting: preview, id: i0 });
  }, [terrain, i0, sunSite, view.cx, view.cy, view.half, aspect, preview, px, is3d]);

  function changeView(scale, from = CENTER, to = from) {
    setViewport(current => {
      const requested = current.view ?? base;
      const before = mapViewport(requested, aspect, zoom, terrain);
      const after = transformMapViewport(before, scale, from, to, zoom, terrain);
      if (after.cx === before.cx && after.cy === before.cy && after.half === before.half) return current;
      return { key: viewKey, view: { ...after, half: after.half === before.half ? requested.half : after.half } };
    });
  }

  const wheelZoom = useEffectEvent(event => {
    const bounds = surface.current.getBoundingClientRect();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1;
    if (bounds.height <= 0 || !event.deltaY || !event.cancelable) return false;
    event.preventDefault();
    const delta = Math.max(-100, Math.min(100, event.deltaY * unit));
    if (delta > 0 && view.half >= maxHalf) return false;
    if (delta < 0 && view.half <= MIN_MAP_HALF) return false;
    const anchor = {
      x: (2 * (event.clientX - bounds.left) - bounds.width) / bounds.height,
      y: 1 - 2 * (event.clientY - bounds.top) / bounds.height,
    };
    setWheeling(true);
    changeView(Math.exp(delta * 0.002), anchor);
    return true;
  });

  useEffect(() => {
    if (!terrain) return;
    const map = wrapper.current;
    let timer;
    function onWheel(event) {
      if (!wheelZoom(event)) return;
      clearTimeout(timer);
      timer = setTimeout(() => setWheeling(false), 150);
    }
    map.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      map.removeEventListener("wheel", onWheel);
      clearTimeout(timer);
    };
  }, [terrain]);

  function startPan(event) {
    const active = pointers.current;
    if (!terrain || event.button !== 0 || active.size >= 2 || (active.size && event.pointerType !== "touch")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    active.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setDragging(true);
  }

  function movePan(event) {
    const active = pointers.current;
    if (!active.has(event.pointerId)) return;
    const bounds = surface.current.getBoundingClientRect();
    if (bounds.height <= 0) return;
    const from = gesture(active, bounds);
    active.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const to = gesture(active, bounds);
    const scale = from.distance > 0 && to.distance > 0 ? from.distance / to.distance : 1;
    changeView(scale, from, to);
  }

  function endPan(event) {
    if (pointers.current.delete(event.pointerId) && !pointers.current.size) setDragging(false);
  }

  // Pointer -> svg units and map km, using the same view the overlay is drawn with.
  function groundAt(event) {
    const b = event.currentTarget.getBoundingClientRect();
    if (b.width <= 0 || b.height <= 0) return null;
    const sx = (event.clientX - b.left) / b.width * mapWidth, sy = (event.clientY - b.top) / b.height * MAP, kmPx = MAP / (2 * overlay.half);
    const { lat, lon } = fromMap(overlay.cx + (sx - mapWidth / 2) / kmPx, overlay.cy - (sy - MAP / 2) / kmPx);
    return { sx, sy, lat, lon, km: poleKm(lat, lon) };
  }
  function place(event) {
    const start = down.current;
    down.current = null;
    if (ask) { if (start) setAsk(null); return; } // a click outside the dialog closes it
    if (!onPlace || !terrain || !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return; // a drag pans
    const g = groundAt(event);
    if (!g) return;
    if (g.km > MAX_POLE_KM) { setPlaceMsg(`Too far from the pole (${Math.round(g.km)} km). Custom sites must be within ${MAX_POLE_KM} km.`); return; }
    setPlaceMsg(onPlace(g.lat, g.lon));
  }
  function openAsk(event) {
    if (!onPlace || !terrain) return;
    event.preventDefault();
    const g = groundAt(event);
    if (g) { setAsk(g); setPlaceMsg(null); }
  }
  function submitAsk(event) {
    event.preventDefault();
    const err = onPlace(ask.lat, ask.lon, new FormData(event.currentTarget).get("name").trim().slice(0, 60) || undefined);
    setPlaceMsg(err);
    if (!err) setAsk(null);
  }

  return (
    <Card className="hud mapcard">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="hud-title">SUNLIGHT AT LANDING</h2>
        <div className="flex flex-wrap items-center gap-1">
          <Button type="button" variant="outline" size="xs" aria-pressed={is3d} disabled={!terrain} onClick={() => setIs3d(!is3d)}>{is3d ? "2D MAP" : "3D VIEW"}</Button>
          {!is3d && <><Button type="button" variant="outline" size="icon-xs" aria-label="Zoom out" disabled={!terrain || view.half >= maxHalf} onClick={() => changeView(1.25)}>
            <MinusIcon aria-hidden="true" className="size-3" />
          </Button>
          <Button type="button" variant="outline" size="icon-xs" aria-label="Zoom in" disabled={!terrain || view.half <= MIN_MAP_HALF} onClick={() => changeView(0.8)}>
            <PlusIcon aria-hidden="true" className="size-3" />
          </Button></>}
          <Button type="button" variant="outline" size="xs" disabled={!mapPicks.length} onClick={onZoom}>{zoom ? "WHOLE REGION" : "CLOSE-UP"}</Button>
        </div>
      </div>
      {is3d && terrain && <Terrain3D terrain={terrain} picks={picks} i0={i0} zoom={zoom} interacting={interacting} />}
      <div ref={wrapper} className="mapwrap" hidden={is3d} data-pan={terrain ? (dragging ? "dragging" : "ready") : undefined}
        onPointerDown={(e) => { down.current = e.button === 0 ? { x: e.clientX, y: e.clientY } : null; startPan(e); }}
        onPointerMove={(e) => { movePan(e); if (e.pointerType !== "touch") setHover(groundAt(e)); }}
        onPointerUp={(e) => { endPan(e); place(e); }} onPointerLeave={() => setHover(null)}
        onPointerCancel={endPan} onLostPointerCapture={endPan} onContextMenu={openAsk}>
        <div className="shadow-surface" id="landing-terrain" data-terrain-error={terrainErr ? true : undefined} ref={surface} />
        <svg viewBox={`0 0 ${mapWidth} ${MAP}`} role="img" aria-label="Map of the lunar south pole: sunlit ground and shadows at landing, with the chosen sites"
          dangerouslySetInnerHTML={{ __html: mapOverlay(overlay, picks, painted?.id ?? i0, mapWidth, MAP) }} />
        {hover && terrain && !ask && <svg className="crosshair" viewBox={`0 0 ${mapWidth} ${MAP}`} aria-hidden="true" data-bad={hover.km > MAX_POLE_KM || undefined}>
          <path className="ch-line" d={`M0,${hover.sy}H${hover.sx - 10}M${hover.sx + 10},${hover.sy}H${mapWidth}M${hover.sx},0V${hover.sy - 10}M${hover.sx},${hover.sy + 10}V${MAP}`} />
          <path className="ch-mark" d={`M${hover.sx - 6},${hover.sy}h12M${hover.sx},${hover.sy - 6}v12`} />
          <circle className="ch-mark" cx={hover.sx} cy={hover.sy} r="10" />
          {(() => {
            const right = hover.sx < mapWidth - 150, x = hover.sx + (right ? 14 : -14), y = Math.max(22, Math.min(MAP - 26, hover.sy - 14));
            const a = right ? "start" : "end";
            return <g className="ch-text">
              <text x={x} y={y} textAnchor={a}>{Math.abs(hover.lat).toFixed(3)}°S {hover.lon.toFixed(2)}°E</text>
              <text x={x} y={y + 12} textAnchor={a}>{hover.km.toFixed(1)} KM FROM POLE{onPlace ? (hover.km > MAX_POLE_KM ? " · TOO FAR" : " · CLICK OR RIGHT-CLICK TO ADD") : ""}</text>
            </g>;
          })()}
        </svg>}
        {ask && (() => {
          const far = ask.km > MAX_POLE_KM, right = ask.sx > mapWidth * 0.6, low = ask.sy > MAP * 0.6;
          return <form className="map-ask" onSubmit={submitAsk} aria-label="Add a custom landing site"
            style={{ left: `${ask.sx / mapWidth * 100}%`, top: `${ask.sy / MAP * 100}%`, translate: `${right ? "-100%" : "0"} ${low ? "-100%" : "0"}` }}
            onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onPointerMove={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") setAsk(null); }}>
            <p className="hud-label">ADD CUSTOM LANDING SITE?</p>
            <p className="map-ask-where">{Math.abs(ask.lat).toFixed(3)}°S {ask.lon.toFixed(2)}°E · {ask.km.toFixed(1)} km from pole</p>
            {far ? <p className="map-ask-err" role="alert">Too far from the pole. Custom sites must be within {MAX_POLE_KM} km.</p>
              : <label className="map-ask-name">Name<input name="name" autoFocus maxLength={60} placeholder="e.g. Ridge north spur" autoComplete="off" /></label>}
            <div className="map-ask-actions">
              <Button type="button" variant="ghost" size="xs" onClick={() => setAsk(null)}>CANCEL</Button>
              {!far && <Button type="submit" variant="outline" size="xs">ADD AND COMPARE</Button>}
            </div>
          </form>;
        })()}
        <span className="map-hud br">LOLA 500 M · MOON_ME</span>
      </div>
      <p className="caption">
        {terrainErr ? `Terrain did not load (${terrainErr}).` : terrain
          ? (is3d ? `Real NASA terrain at landing, ${when}, 00:00 UTC, heights ×${EXAG}. Bright = sunlit, dark = shadow, contours every 500 m. Drag to orbit, scroll or pinch to zoom.`
            : `Real NASA terrain at landing, ${when}, 00:00 UTC. Light = sunlit, black = shadow. Earth-facing side (0°) up.`)
          : "Loading terrain…"}
      </p>
      {mapPicks.length < picks.length && <p className="caption">Apollo 11 is outside the south-pole map coverage.</p>}
      {onPlace && terrain && !is3d && <p className="caption" role="status">{placeMsg ?? `Click any spot within ${MAX_POLE_KM} km of the pole to drop a custom site as site 2, or right-click to name it first. Drag to pan, scroll to zoom.`}</p>}
    </Card>
  );
}
