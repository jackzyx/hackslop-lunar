import { memo, useMemo, useState } from "react";
import { WINDOW_H, maskAt, windowMetrics } from "@/metrics.js";
import { data, sites, vis, t0, H, fmtTime, latLon, dur } from "@/lib/data.js";
import { TL, P, panorama, yRange } from "@/lib/charts.js";
import VisibilityTimeline from '@/components/VisibilityTimeline';
import { validation, fmtDeg, worst } from "@/lib/validation.js";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Chart hover text follows the mouse, so it is a positioned box rather than an anchored tooltip.
function useTip() {
  const [tip, setTip] = useState(null);
  const bind = (text) => ({
    onMouseMove: (ev) => {
      const r = ev.currentTarget.getBoundingClientRect(), s = text(((ev.clientX - r.left) / r.width) * 600);
      setTip(s ? { s, x: ev.clientX, y: ev.clientY } : null);
    },
    onMouseLeave: () => setTip(null),
  });
  const el = tip && (
    <div className="tip" style={tip.x > innerWidth - 360 ? { right: innerWidth - tip.x + 14, top: tip.y + 16 } : { left: tip.x + 14, top: tip.y + 16 }}>{tip.s}</div>
  );
  return [bind, el];
}

function nextEvent(m) {
  const ev = [["SUNSET IN", m.sunsetIn], ["EARTHSET IN", m.earthsetIn]].filter(([, h]) => h !== null);
  if (!ev.length) return ["NEXT SET", "SUN AND EARTH ALREADY HIDDEN"];
  const [name, h] = ev.reduce((a, b) => (b[1] < a[1] ? b : a));
  return h === Infinity ? ["NEXT SET", "NONE IN FIRST 30 DAYS"] : [name, dur(h).toUpperCase()];
}

function SiteDetail({ n, id, i0, yr, bind }) {
  const site = sites[id], eph = data.ephemeris.sites[id];
  const v = vis(id);
  const az = eph.sun_az[i0], el = eph.sun_el[i0];
  const margin = el - maskAt(site.horizon, az);
  const [evName, evVal] = nextEvent(windowMetrics(v, i0));
  return (
    <Card className="hud detail">
      <h3 className="hud-title">SITE {n} · {site.name.toUpperCase()}</h3>
      <p className="hud-label">{latLon(site)}</p>
      <p className="hud-label">SUN AND EARTH · 30 DAYS FROM LANDING</p>
      <VisibilityTimeline key={id} visibility={v} i0={i0}
        {...bind((x) => {
          const k = Math.floor(((x - TL.x0) / (TL.x1 - TL.x0)) * WINDOW_H);
          if (k < 0 || k >= WINDOW_H) return null;
          const i = i0 + k;
          return `${fmtTime(t0 + i * H)} UTC · Sun ${Math.round(v.sun[i] * 100)} % visible · Earth ${v.earth[i] ? "in view" : "hidden"}`;
        })} />
      <p className="readout">{evName} · {evVal}</p>
      <p className="hud-label">SKYLINE 360° · SUN AND EARTH PATHS</p>
      <svg viewBox="0 0 600 186" role="img" aria-label="Skyline all around the site with the Sun and Earth paths" dangerouslySetInnerHTML={{ __html: panorama(site.horizon, eph, i0, yr) }}
        {...bind((x) => {
          const az = ((x - P.x0) / (P.x1 - P.x0)) * 360;
          return az < 0 || az >= 360 ? null : `Azimuth ${az.toFixed(0)}° · skyline ${maskAt(site.horizon, az).toFixed(1)}° up`;
        })} />
      <p className="readout">SUN AT LANDING · AZIMUTH {az.toFixed(1)}° · ELEVATION {el.toFixed(1)}° · {Math.abs(margin).toFixed(1)}° {margin >= 0 ? "ABOVE" : "BELOW"} SKYLINE</p>
    </Card>
  );
}

function DetailTabs({ picks, i0, tab, onTab }) {
  const [bind, tipEl] = useTip(), yr = useMemo(() => yRange(picks), [picks]), v = validation;
  const illumination = v.checks.find((c) => c.id === "V4");
  return (
    <Tabs value={tab} onValueChange={onTab} className="details" id="details">
      <TabsList variant="line" className="hud-tabs">
        <TabsTrigger value="skylines">SKYLINES + 30 DAYS</TabsTrigger>
        <TabsTrigger value="validation">VALIDATION</TabsTrigger>
        <TabsTrigger value="limits">NOT MODELLED</TabsTrigger>
      </TabsList>

      <TabsContent value="skylines" className="grid gap-4 md:grid-cols-2">
        {picks.map((id, c) => <SiteDetail key={c} n={c + 1} id={id} i0={i0} yr={yr} bind={bind} />)}
      </TabsContent>

      <TabsContent value="validation">
        <Card className="hud">
          {illumination && (
            <section className="grid gap-2 pb-3">
              <h3 className="hud-title">TERRAIN ILLUMINATION CHECK</h3>
              <p className="caption">This check compares long-term surface sunlight with NASA’s polar illumination maps.</p>
              <p className="checks">{illumination.result ?? "Check pending."}</p>
            </section>
          )}
          <h3 className="hud-title">SUN AND EARTH POSITION CHECK</h3>
          <p className="caption">We compared the modeled Sun and Earth angles with NASA JPL Horizons at the locations and dates below. {worst === null ? "Check pending." : `The largest reported difference was ${fmtDeg(worst)}.`}</p>
          <Table className="hud-table">
            <TableHeader>
              <TableRow><TableHead>SITE</TableHead><TableHead>BODY</TableHead><TableHead>MAX |ΔEL|</TableHead><TableHead>MAX |ΔAZ|·COS EL</TableHead><TableHead>HOURS</TableHead><TableHead>DATES</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {v.rows.map((r, k) => (
                <TableRow key={k}>
                  <TableCell>{r.site}</TableCell><TableCell>{r.body}</TableCell><TableCell>{fmtDeg(r.max_del_deg)}</TableCell>
                  <TableCell>{fmtDeg(r.max_daz_cos_deg)}</TableCell><TableCell>{r.hours ?? "–"}</TableCell><TableCell>{r.start ? `${r.start} to ${r.stop}` : "–"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="caption">Pass mark {v.pass_deg}°. Reference: JPL Horizons, topocentric site on the Moon, airless, frame MOON_ME, correction LT+S. {v.queried ? `Queried ${v.queried}.` : "Not yet queried."}</p>
          <ul className="checks">{v.checks.filter((c) => c !== illumination).map((c) => <li key={c.id}><span className="hud-label">{c.id}</span> {c.label}: {c.result ?? "not yet run"}</li>)}</ul>
        </Card>
      </TabsContent>

      <TabsContent value="limits">
        <Card className="hud">
          <h3 className="hud-title">WHAT WE DO NOT MODEL</h3>
          <p className="caption">The site comparisons use a 2 m mast to calculate visibility.</p>
          <ul className="limits">
            <li>No power or thermal model</li>
            <li>No radio link budget: Earth contact is line of sight only</li>
            <li>No slopes or landing hazards</li>
            <li>Curated sites only, no custom coordinates</li>
          </ul>
        </Card>
      </TabsContent>
      {tipEl}
    </Tabs>
  );
}

export default memo(DetailTabs);
