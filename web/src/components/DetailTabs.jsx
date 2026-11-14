import { memo, useMemo, useState } from "react";
import { WINDOW_H, maskAt } from "@/metrics.js";
import { data, sites, vis, t0, H, fmtTime } from "@/lib/data.js";
import { TL, P, timeline, panorama, yRange } from "@/lib/charts.js";
import { validation, fmtDeg } from "@/lib/validation.js";
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

function SiteDetail({ n, id, i0, yr, bind }) {
  const v = vis(id);
  return (
    <Card className="hud detail">
      <h3 className="hud-title">SITE {n} · {sites[id].name.toUpperCase()}</h3>
      <p className="hud-label">SUN AND EARTH · 30 DAYS FROM LANDING</p>
      <svg viewBox="0 0 600 84" role="img" aria-label="Sun and Earth over the 30 days" dangerouslySetInnerHTML={{ __html: timeline(v, i0) }}
        {...bind((x) => {
          const k = Math.floor(((x - TL.x0) / (TL.x1 - TL.x0)) * WINDOW_H);
          if (k < 0 || k >= WINDOW_H) return null;
          const i = i0 + k;
          return `${fmtTime(t0 + i * H)} UTC · Sun ${Math.round(v.sun[i] * 100)} % visible · Earth ${v.earth[i] ? "in view" : "hidden"}`;
        })} />
      <p className="hud-label">SKYLINE 360° · SUN AND EARTH PATHS</p>
      <svg viewBox="0 0 600 186" role="img" aria-label="Skyline all around the site with the Sun and Earth paths" dangerouslySetInnerHTML={{ __html: panorama(sites[id].horizon, data.ephemeris.sites[id], i0, yr) }}
        {...bind((x) => {
          const az = ((x - P.x0) / (P.x1 - P.x0)) * 360;
          return az < 0 || az >= 360 ? null : `Azimuth ${az.toFixed(0)}° · skyline ${maskAt(sites[id].horizon, az).toFixed(1)}° up`;
        })} />
    </Card>
  );
}

function DetailTabs({ picks, i0, tab, onTab }) {
  const [bind, tipEl] = useTip(), yr = useMemo(() => yRange(picks), [picks]), v = validation;
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
          <h3 className="hud-title">CHECK AGAINST NASA JPL HORIZONS</h3>
          {!v.queried && <p className="caption">Filled from <code>src/validation.json</code>, written by the Science pipeline (checks V1 to V8 in <code>context/04-science.md</code>).</p>}
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
          <ul className="checks">{v.checks.map((c) => <li key={c.id}><span className="hud-label">{c.id}</span> {c.label}: {c.result ?? "not yet run"}</li>)}</ul>
        </Card>
      </TabsContent>

      <TabsContent value="limits">
        <Card className="hud">
          <h3 className="hud-title">WHAT WE DO NOT MODEL</h3>
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
