import { useEffect, useRef, useState } from "react";
import { createShadowRenderer } from "@/shadow-renderer.js";
import { sites, sunAt } from "@/lib/data.js";
import { mapView } from "@/shadow.js";
import { mapOverlay } from "@/lib/charts.js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MAP = 360; // canvas pixels; CSS scales it to the panel

// Real terrain with the shadows at the landing instant (shadow.js), lon 0 up, 90 E right.
// The Sun direction comes from the first chosen site's row of the same table the cards use.
export default function ShadowMap({ picks, i0, when, zoom, onZoom, terrain, terrainErr, interacting = false }) {
  const surface = useRef(null), renderer = useRef(null), [aspect, setAspect] = useState(1);
  const base = mapView(picks.map(id => sites[id]), zoom);
  // Whole-region views stay inside the available DEM instead of exposing empty
  // strips at the sides of a wide panel. Close-ups retain their selected-site fit.
  const view = { ...base, half: zoom ? base.half : Math.min(base.half, 248 / Math.max(1, aspect)), aspect };
  const mapWidth = MAP * aspect;
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
    renderer.current = createShadowRenderer(terrain, surface.current);
    return () => { renderer.current.dispose(); renderer.current = null; };
  }, [terrain]);
  useEffect(() => {
    renderer.current?.request({ sun: sunAt(picks[0], i0), view, size: interacting ? 256 : 512, interacting, id: i0 });
  }, [terrain, i0, picks[0], view.cx, view.cy, view.half, aspect, interacting]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="hud mapcard">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="hud-title">SUNLIGHT AT LANDING</h2>
        <Button variant="outline" size="xs" onClick={onZoom}>{zoom ? "WHOLE REGION" : "CLOSE-UP ON THE TWO SITES"}</Button>
      </div>
      <div className="mapwrap">
        <div className="shadow-surface" id="landing-terrain" data-terrain-error={terrainErr ? true : undefined} ref={surface} />
        <svg viewBox={`0 0 ${mapWidth} ${MAP}`} role="img" aria-label="Map of the lunar south pole: sunlit ground and shadows at landing, with the chosen sites"
          dangerouslySetInnerHTML={{ __html: mapOverlay(view, picks, i0, mapWidth, MAP) }} />
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
