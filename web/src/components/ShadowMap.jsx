import { useEffect, useRef } from "react";
import { shadeView, paint } from "@/shadow.js";
import { data, sunAt } from "@/lib/data.js";
import { mapView, mapOverlay } from "@/lib/charts.js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MAP = 360; // canvas pixels; CSS scales it to the panel

// Real terrain with the shadows at the landing instant (shadow.js), lon 0 up, 90 E right.
// The Sun direction comes from the first chosen site's row of the same table the cards use.
export default function ShadowMap({ picks, i0, when, zoom, onZoom, terrain, terrainErr }) {
  const cv = useRef(null), view = mapView(picks, zoom);
  useEffect(() => {
    if (!terrain) return;
    const raf = requestAnimationFrame(() => { // ~0.1 s per frame: draw at most once per frame while the slider moves
      const ctx = cv.current.getContext("2d"), img = ctx.createImageData(MAP, MAP);
      paint(shadeView(terrain, sunAt(picks[0], i0), view, MAP), img.data);
      ctx.putImageData(img, 0, 0);
    });
    return () => cancelAnimationFrame(raf);
  }, [terrain, i0, picks[0], view.cx, view.cy, view.half]); // eslint-disable-line react-hooks/exhaustive-deps

  const e = data.ephemeris.sites[picks[0]];
  return (
    <Card className="hud mapcard">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="hud-title">SUNLIGHT AT LANDING</h2>
        <Button variant="outline" size="xs" onClick={onZoom}>{zoom ? "WHOLE REGION" : "CLOSE-UP ON THE TWO SITES"}</Button>
      </div>
      <div className="mapwrap">
        <canvas ref={cv} width={MAP} height={MAP} />
        <svg viewBox={`0 0 ${MAP} ${MAP}`} role="img" aria-label="Map of the lunar south pole: sunlit ground and shadows at landing, with the chosen sites"
          dangerouslySetInnerHTML={{ __html: mapOverlay(view, picks, i0, MAP) }} />
        <span className="map-hud tl">SUN @ SITE 1 · AZ {e.sun_az[i0].toFixed(1)}° · EL {e.sun_el[i0].toFixed(1)}°</span>
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
