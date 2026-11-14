import { memo, useMemo, useState } from "react";
import { WINDOW_H, maskAt, windowMetrics, visibility } from "@/domain/metrics.js";
import { data, sites, vis, t0, H, DAY, iso, fmtDate, fmtTime, latLon, dur } from "@/lib/data.js";
import { hourlyWindows, bestDays, GOALS } from "@/domain/best-days.js";
import { methodCheck } from "@/domain/custom-site.js";
import { Button } from "@/components/ui/button";
import { TL, P, panorama, skylineY, yRange } from "@/lib/charts.js";
import VisibilityTimeline from '@/components/VisibilityTimeline';
import { validation, fmtDeg, worst } from "@/lib/validation.js";
import { Card } from "@/components/ui/card";
import HelpTip from '@/components/HelpTip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Chart hover text follows the mouse, so it is a positioned box rather than an anchored tooltip.
function useTip(i0) {
  const [tip, setTip] = useState(null);
  const bind = (readHover) => ({
    onMouseMove: (ev) => {
      const transform = ev.currentTarget.getScreenCTM();
      const point = transform && new DOMPoint(ev.clientX, ev.clientY).matrixTransform(transform.inverse());
      const hover = point && readHover(point);
      setTip(hover ? { ...hover, x: ev.clientX, y: ev.clientY } : null);
    },
    onMouseLeave: () => setTip(null),
  });
  const el = tip && (
    <div className="tip" style={tip.x > innerWidth - 360 ? { right: innerWidth - tip.x + 14, top: tip.y + 16 } : { left: tip.x + 14, top: tip.y + 16 }}>{tip.timelineText ? tip.timelineText(i0) : tip.s}</div>
  );
  return [bind, el, tip?.guide];
}

function nextEvent(m) {
  const ev = [["SUNSET IN", m.sunsetIn], ["EARTHSET IN", m.earthsetIn]].filter(([, h]) => h !== null);
  if (!ev.length) return ["NEXT SET", "SUN AND EARTH ALREADY HIDDEN"];
  const [name, h] = ev.reduce((a, b) => (b[1] < a[1] ? b : a));
  return h === Infinity ? ["NEXT SET", "NONE IN FIRST 30 DAYS"] : [name, dur(h).toUpperCase()];
}

const SkylinePlot = memo(function SkylinePlot({ horizon, eph, i0, yr }) {
  return <g dangerouslySetInnerHTML={{ __html: panorama(horizon, eph, i0, yr) }} />;
});

function SiteDetail({ n, id, i0, yr, bind, guide, onShiftDate }) {
  const site = sites[id], eph = data.ephemeris.sites[id];
  const v = vis(id);
  const az = eph.sun_az[i0], el = eph.sun_el[i0];
  const margin = el - maskAt(site.horizon, az);
  const [evName, evVal] = nextEvent(windowMetrics(v, i0));
  return (
    <Card className="hud detail">
      <h3 className="hud-title">SITE {n} · {site.name.toUpperCase()}</h3>
      <p className="hud-label">{latLon(site)}</p>
      {site.terrain_modelled === false && <p className="caption">Smooth-sphere horizon · Terrain not modelled</p>}
      <p className="hud-label">SUN AND EARTH · 30 DAYS FROM LANDING</p>
      <VisibilityTimeline key={id} visibility={v} i0={i0} onShiftDate={onShiftDate}
        {...bind(({ x }) => {
          const k = Math.floor(((x - TL.x0) / (TL.x1 - TL.x0)) * WINDOW_H);
          if (k < 0 || k >= WINDOW_H) return null;
          return { timelineText: (start) => {
            const i = start + k;
            return `${fmtTime(t0 + i * H)} UTC · Sun ${Math.round(v.sun[i] * 100)} % visible · Earth ${v.earth[i] ? "in view" : "hidden"}`;
          } };
        })} />
      <p className="readout">{evName} · {evVal}</p>
      <p className="hud-label">SKYLINE 360° · SUN AND EARTH PATHS<HelpTip label="skyline chart">The terrain height in every direction around the site. Azimuth is direction clockwise from north; elevation is angle above the local horizontal. Terrain can hide the Sun or Earth when their paths dip below the skyline.</HelpTip></p>
      <svg viewBox="0 0 600 186" role="img" aria-label="Skyline all around the site with the Sun and Earth paths"
        {...bind(({ x, y }) => {
          if (x < P.x0 || x > P.x1 || y < P.y0 || y > P.y1) return null;
          const az = ((x - P.x0) / (P.x1 - P.x0)) * 360;
          const elevation = maskAt(site.horizon, az);
          return { s: `Azimuth ${az.toFixed(0)}° · skyline ${elevation.toFixed(1)}° up`, guide: { n, x, y: skylineY(elevation, yr) } };
        })}>
        <SkylinePlot horizon={site.horizon} eph={eph} i0={i0} yr={yr} />
        {guide?.n === n && (
          <g className="skyline-hover" aria-hidden="true">
            <line x1={guide.x} x2={guide.x} y1={P.y0} y2={P.y1} />
            <circle cx={guide.x} cy={guide.y} r="4" />
          </g>
        )}
      </svg>
      <p className="readout">SUN AT LANDING · AZIMUTH {az.toFixed(1)}° · ELEVATION {el.toFixed(1)}° · {Math.abs(margin).toFixed(1)}° {margin >= 0 ? "ABOVE" : "BELOW"} SKYLINE</p>
    </Card>
  );
}

// Find the best landing hour across the candidate dates.
function BestDays({ n, id, iPlanned, dateMax, onLand }) {
  const plannedDay = iso(t0 + iPlanned * H);
  const dayStart = Date.parse(`${plannedDay}T00:00:00Z`);
  const iFrom = (dayStart - t0) / H;
  const days = Math.min(365, Math.floor((Date.parse(`${dateMax}T00:00:00Z`) - dayStart) / DAY) + 1);
  const rows = useMemo(() => hourlyWindows(vis(id), iFrom, days), [id, iFrom, days]);
  return (
    <Card className="hud detail">
      <h3 className="hud-title">SITE {n} · {sites[id].name.toUpperCase()}</h3>
      <p className="hud-label">Best landing days · 12 months from {fmtDate(dayStart, { year: "numeric" })} · all UTC hours · 30-day windows</p>
      <Table className="hud-table">
        <TableHeader><TableRow><TableHead>GOAL</TableHead><TableHead>LAND</TableHead><TableHead>SUN</TableHead><TableHead>EARTH</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {Object.entries(GOALS).flatMap(([goal, { label }]) => bestDays(rows, goal).map((r, k) => {
            const day = iso(t0 + r.i * H);
            const landingHour = new Date(t0 + r.i * H).getUTCHours();
            const hourLabel = `${String(landingHour).padStart(2, '0')}:00 UTC`;
            return <TableRow key={goal + r.d}>
              <TableCell>{k === 0 ? label.toUpperCase() : ""}</TableCell>
              <TableCell>{fmtDate(t0 + r.i * H, { weekday: "short", year: "numeric" })}<br />{hourLabel}</TableCell>
              <TableCell>{Math.round(r.sunlit)} h</TableCell><TableCell>{Math.round(r.earth)} h</TableCell>
              <TableCell><Button type="button" variant="outline" size="xs" onClick={() => onLand(day, landingHour)} aria-label={`Plan landing on ${day} at ${hourLabel}`}>LAND</Button></TableCell>
            </TableRow>;
          }))}
        </TableBody>
      </Table>
      <p className="caption">“Best of both” maximises the weaker of sunlight and Earth hours. Searches every hour; equal scores favour the earliest time. Options are at least 7 days apart. LAND keeps the recommended time and resets both slip sliders to 0. Earth = line of sight, not a radio link.</p>
    </Card>
  );
}

function MethodCheck({ terrain }) {
  const rows = useMemo(() => {
    if (!terrain) return null;
    const shipped = data.sites.filter((s) => !s.custom && s.terrain_modelled !== false).map((s) => ({ ...s, table: data.ephemeris.sites[s.id] }));
    return methodCheck(terrain, shipped, visibility, windowMetrics, WINDOW_H);
  }, [terrain]);
  if (!rows) return <p className="caption">Custom-site check runs once the terrain has loaded.</p>;
  return (
    <section className="grid gap-2 pt-3">
      <h3 className="hud-title">CUSTOM-SITE METHOD CHECK</h3>
      <p className="caption">Each curated site rebuilt from its coordinates alone, the way custom sites are: horizon from the 500 m map terrain in the browser, Sun and Earth angles from the nearest other site. Compared with the curated numbers (SPICE angles, 80 m terrain horizon), 30-day windows every 7 days over the whole table.</p>
      <Table className="hud-table">
        <TableHeader><TableRow><TableHead>SITE</TableHead><TableHead>FROM POLE</TableHead><TableHead>HORIZON RMS</TableHead><TableHead>MAX ANGLE ERROR</TableHead><TableHead>SUNLIGHT MAX |Δ|</TableHead><TableHead>MEAN Δ</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((r) => <TableRow key={r.id}>
          <TableCell>{r.name}</TableCell><TableCell>{r.km.toFixed(0)} km</TableCell><TableCell>{r.maskRms.toFixed(2)}°</TableCell>
          <TableCell>{fmtDeg(r.angleMax)}</TableCell><TableCell>{Math.round(r.sunlitMax)} h</TableCell><TableCell>{r.sunlitMean >= 0 ? "+" : "−"}{Math.abs(r.sunlitMean).toFixed(0)} h</TableCell>
        </TableRow>)}</TableBody>
      </Table>
      <p className="caption">Angles agree with SPICE. The coarser terrain is the weak point: on narrow ridges and peaks it misses nearby relief and overstates sunlight, so treat custom-site sunlight as a screening estimate.</p>
    </section>
  );
}

function DetailTabs({ picks, i0, tab, onTab, terrain, iPlanned, dateMax, onLand, onShiftDate }) {
  const [bind, tipEl, guide] = useTip(i0), yr = useMemo(() => yRange(picks), [picks]), v = validation;
  const illumination = v.checks.find((c) => c.id === "V4");
  return (
    <Tabs value={tab} onValueChange={onTab} className="details" id="details">
      <TabsList variant="line" className="hud-tabs">
        <TabsTrigger value="skylines">SKYLINES + 30 DAYS</TabsTrigger>
        <TabsTrigger value="best">BEST LANDING DAYS</TabsTrigger>
        <TabsTrigger value="validation">VALIDATION</TabsTrigger>
        <TabsTrigger value="limits">NOT MODELLED</TabsTrigger>
      </TabsList>

      <TabsContent value="skylines" className="skyline-panels">
        {picks.map((id, c) => <SiteDetail key={c} n={c + 1} id={id} i0={i0} yr={yr} bind={bind} guide={guide} onShiftDate={onShiftDate} />)}
      </TabsContent>

      <TabsContent value="best" className="grid gap-4 md:grid-cols-2">
        {tab === "best" && picks.map((id, c) => <BestDays key={c} n={c + 1} id={id} iPlanned={iPlanned} dateMax={dateMax} onLand={onLand} />)}
      </TabsContent>

      <TabsContent value="validation">
        <Card className="hud">
          {illumination && (
            <section className="grid gap-2 pb-3">
              <h3 className="hud-title">TERRAIN ILLUMINATION CHECK</h3>
              <p className="checks">{illumination.result ?? "Check pending."}</p>
              {illumination.method && <p className="caption">{illumination.method}</p>}
              {illumination.mapCrossCheck && <p className="checks">{illumination.mapCrossCheck}</p>}
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
          {tab === "validation" && <MethodCheck terrain={terrain} />}
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
          </ul>
        </Card>
      </TabsContent>
      {tipEl}
    </Tabs>
  );
}

export default memo(DetailTabs);
