import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Crosshair, MinusIcon, PlusIcon } from "lucide-react";
import { createShadowRenderer } from "@/terrain/shadow-renderer.js";
import { sites, sunAt } from "@/lib/data.js";
import { mapView, mapViewport, MIN_MAP_HALF, transformMapViewport } from "@/terrain/shadow.js";
import { mapOverlay } from "@/lib/charts.js";
import { fromMap, poleKm, MAX_POLE_KM } from "@/domain/custom-site.js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  const [placing, setPlacing] = useState(false);
  const [hover, setHover] = useState(null); // live crosshair: svg position and the ground under it
  const [placeMsg, setPlaceMsg] = useState(null);
  const pointers = useRef(new Map());
  const [aspect, setAspect] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [wheeling, setWheeling] = useState(false);
  const [painted, setPainted] = useState(null);
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
      if (width > 0 && height > 0) setAspect(Math.round(width / height * 10000) / 10000);
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
    if (aspect === null) return;
    renderer.current?.request({ sun: sunAt(sunSite, i0), view, size: preview ? 256 : 512, interacting: preview, id: i0 });
  }, [terrain, i0, sunSite, view.cx, view.cy, view.half, aspect, preview]);

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
    if (!placing || !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return; // a drag pans
    const g = groundAt(event);
    if (!g) return;
    if (g.km > MAX_POLE_KM) { setPlaceMsg(`Too far from the pole (${Math.round(g.km)} km). Custom sites must be within ${MAX_POLE_KM} km.`); return; }
    const err = onPlace(g.lat, g.lon);
    setPlaceMsg(err);
    if (!err) setPlacing(false);
  }

  return (
    <Card className="hud mapcard">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="hud-title">SUNLIGHT AT LANDING</h2>
        <div className="flex flex-wrap items-center gap-1">
          <Button type="button" variant="outline" size="icon-xs" aria-label="Zoom out" disabled={!terrain || view.half >= maxHalf} onClick={() => changeView(1.25)}>
            <MinusIcon aria-hidden="true" className="size-3" />
          </Button>
          <Button type="button" variant="outline" size="icon-xs" aria-label="Zoom in" disabled={!terrain || view.half <= MIN_MAP_HALF} onClick={() => changeView(0.8)}>
            <PlusIcon aria-hidden="true" className="size-3" />
          </Button>
          <Button type="button" variant="outline" size="xs" disabled={!mapPicks.length} onClick={onZoom}>{zoom ? "WHOLE REGION" : "CLOSE-UP"}</Button>
          {onPlace && <Button type="button" variant="outline" size="xs" disabled={!terrain} aria-pressed={placing} className="place-btn" onClick={() => { setPlacing(!placing); setPlaceMsg(null); }}>
            <Crosshair aria-hidden="true" className="size-3" />{placing ? "CANCEL" : "CUSTOM SITE"}
          </Button>}
        </div>
      </div>
      <div ref={wrapper} className="mapwrap" data-pan={terrain ? (dragging ? "dragging" : "ready") : undefined} data-placing={placing || undefined}
        onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY }; startPan(e); }}
        onPointerMove={(e) => { movePan(e); if (e.pointerType !== "touch") setHover(groundAt(e)); }}
        onPointerUp={(e) => { endPan(e); place(e); }} onPointerLeave={() => setHover(null)}
        onPointerCancel={endPan} onLostPointerCapture={endPan}>
        <div className="shadow-surface" id="landing-terrain" data-terrain-error={terrainErr ? true : undefined} ref={surface} />
        <svg viewBox={`0 0 ${mapWidth} ${MAP}`} role="img" aria-label="Map of the lunar south pole: sunlit ground and shadows at landing, with the chosen sites"
          dangerouslySetInnerHTML={{ __html: mapOverlay(overlay, picks, painted?.id ?? i0, mapWidth, MAP) }} />
        {hover && terrain && <svg className="crosshair" viewBox={`0 0 ${mapWidth} ${MAP}`} aria-hidden="true" data-bad={placing && hover.km > MAX_POLE_KM || undefined}>
          <path className="ch-line" d={`M0,${hover.sy}H${hover.sx - 10}M${hover.sx + 10},${hover.sy}H${mapWidth}M${hover.sx},0V${hover.sy - 10}M${hover.sx},${hover.sy + 10}V${MAP}`} />
          <path className="ch-mark" d={`M${hover.sx - 6},${hover.sy}h12M${hover.sx},${hover.sy - 6}v12`} />
          <circle className="ch-mark" cx={hover.sx} cy={hover.sy} r="10" />
          {(() => {
            const right = hover.sx < mapWidth - 150, x = hover.sx + (right ? 14 : -14), y = Math.max(22, Math.min(MAP - 26, hover.sy - 14));
            const a = right ? "start" : "end";
            return <g className="ch-text">
              <text x={x} y={y} textAnchor={a}>{Math.abs(hover.lat).toFixed(3)}°S {hover.lon.toFixed(2)}°E</text>
              <text x={x} y={y + 12} textAnchor={a}>{hover.km.toFixed(1)} KM FROM POLE{placing ? (hover.km > MAX_POLE_KM ? " · TOO FAR" : " · CLICK TO PLACE") : ""}</text>
            </g>;
          })()}
        </svg>}
        <span className="map-hud br">LOLA 500 M · MOON_ME</span>
      </div>
      <p className="caption">
        {terrainErr ? `Terrain did not load (${terrainErr}).` : terrain
          ? `Real NASA terrain at landing, ${when}, 00:00 UTC. Light = sunlit, black = shadow. Earth-facing side (0°) up.`
          : "Loading terrain…"}
      </p>
      {mapPicks.length < picks.length && <p className="caption">Apollo 11 is outside the south-pole map coverage.</p>}
      {(placing || placeMsg) && <p className="caption" role="status">{placeMsg ?? `Click the map to place a custom site (within ${MAX_POLE_KM} km of the pole). Drag still pans.`}</p>}
    </Card>
  );
}
