import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createShadowRenderer } from "@/shadow-renderer.js";
import { sites, sunAt } from "@/lib/data.js";
import { mapView, mapViewport } from "@/shadow.js";
import { mapOverlay } from "@/lib/charts.js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MAP = 360; // canvas pixels; CSS scales it to the panel

// Real terrain with the shadows at the landing instant (shadow.js), lon 0 up, 90 E right.
// The Sun direction comes from the first chosen site's row of the same table the cards use.
export default function ShadowMap({ picks, i0, when, zoom, onZoom, terrain, terrainErr, mapCenter, interacting = false }) {
  const surface = useRef(null), renderer = useRef(null), drag = useRef(null);
  const [aspect, setAspect] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [painted, setPainted] = useState(null);
  const viewKey = zoom ? picks.join(":") : "";
  const [pan, setPan] = useState({ key: viewKey, center: null });
  if (pan.key !== viewKey) setPan({ key: viewKey, center: null });

  const base = mapView(picks.map(id => sites[id]), zoom);
  const view = mapViewport({ ...base, ...pan.center }, aspect, zoom, terrain ?? undefined);
  const preview = interacting || dragging;
  const overlay = painted?.view ?? view;
  const mapWidth = MAP * overlay.aspect;
  useLayoutEffect(() => {
    mapCenter.current = { cx: view.cx, cy: view.cy };
  }, [mapCenter, view.cx, view.cy]);
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
    renderer.current?.request({ sun: sunAt(picks[0], i0), view, size: preview ? 256 : 512, interacting: preview, id: i0 });
  }, [terrain, i0, picks[0], view.cx, view.cy, view.half, aspect, preview]);

  function startPan(event) {
    if (!terrain || drag.current || event.button !== 0) return;
    const height = surface.current.getBoundingClientRect().height;
    if (height <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      cx: view.cx, cy: view.cy, key: viewKey, kmPerPixel: 2 * view.half / height,
    };
    setDragging(true);
  }

  function movePan(event) {
    const active = drag.current;
    if (active?.pointerId !== event.pointerId || active.key !== viewKey) return;
    const { cx, cy } = mapViewport({
      half: base.half,
      cx: active.cx - (event.clientX - active.x) * active.kmPerPixel,
      cy: active.cy + (event.clientY - active.y) * active.kmPerPixel,
    }, aspect, zoom, terrain);
    Object.assign(active, { x: event.clientX, y: event.clientY, cx, cy });
    setPan({ key: viewKey, center: { cx, cy } });
  }

  function endPan(event) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  }

  return (
    <Card className="hud mapcard">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="hud-title">SUNLIGHT AT LANDING</h2>
        <Button variant="outline" size="xs" onClick={onZoom}>{zoom ? "WHOLE REGION" : "CLOSE-UP ON THE TWO SITES"}</Button>
      </div>
      <div className="mapwrap" data-pan={terrain ? (dragging ? "dragging" : "ready") : undefined}
        onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan}
        onPointerCancel={endPan} onLostPointerCapture={endPan}>
        <div className="shadow-surface" id="landing-terrain" data-terrain-error={terrainErr ? true : undefined} ref={surface} />
        <svg viewBox={`0 0 ${mapWidth} ${MAP}`} role="img" aria-label="Map of the lunar south pole: sunlit ground and shadows at landing, with the chosen sites"
          dangerouslySetInnerHTML={{ __html: mapOverlay(overlay, picks, painted?.id ?? i0, mapWidth, MAP) }} />
        <span className="map-hud br">LOLA 500 M · MOON_ME</span>
      </div>
      <p className="caption">
        {terrainErr ? `Terrain did not load (${terrainErr}).` : terrain
          ? `Real NASA terrain at landing, ${when}, 00:00 UTC. Light = sunlit, black = shadow. Earth-facing side (0°) up.`
          : "Loading terrain…"}
      </p>
    </Card>
  );
}
