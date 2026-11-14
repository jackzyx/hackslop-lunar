import { useEffect, useRef } from "react";
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
  const surface = useRef(null), renderer = useRef(null), view = mapView(picks.map(id => sites[id]), zoom);
  useEffect(() => {
    if (!terrain) return;
    renderer.current = createShadowRenderer(terrain, surface.current);
    return () => { renderer.current.dispose(); renderer.current = null; };
  }, [terrain]);
  useEffect(() => {
    renderer.current?.request({ sun: sunAt(picks[0], i0), view, size: interacting ? 256 : 512, interacting, id: i0 });
  }, [terrain, i0, picks[0], view.cx, view.cy, view.half, interacting]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="hud mapcard">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="hud-title">SUNLIGHT AT LANDING</h2>
        <Button variant="outline" size="xs" onClick={onZoom}>{zoom ? "WHOLE REGION" : "CLOSE-UP ON THE TWO SITES"}</Button>
      </div>
      <div className="mapwrap">
        <div className="shadow-surface" id="landing-terrain" data-terrain-error={terrainErr ? true : undefined} ref={surface} />
        <svg viewBox={`0 0 ${MAP} ${MAP}`} role="img" aria-label="Map of the lunar south pole: sunlit ground and shadows at landing, with the chosen sites"
          dangerouslySetInnerHTML={{ __html: mapOverlay(view, picks, i0, MAP) }} />
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
