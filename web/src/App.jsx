import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { windowMetrics, verdictDelay, MAX_DELAY_D } from "@/domain/metrics.js";
import { initialTerrain } from '@/terrain/startup.js';
import { narrate } from "@/domain/narrator.js";
import { data, sites, vis, t0, H, DAY, iso, fmtDate, reducedMotion } from "@/lib/data.js";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import SiteCard from "@/components/SiteCard";
import ShadowMap from "@/components/ShadowMap";
import DetailTabs from "@/components/DetailTabs";
import About from "@/components/About";
import LandingDatePicker from "@/components/LandingDatePicker";
import { currentPage, routeUrl } from "@/lib/routes.js";

export default function App() {
  const [page, setPage] = useState(currentPage);
  const [date, setDate] = useState("2026-11-20");
  const [delay, setDelay] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const [picks, setPicks] = useState(["A", "B"]);
  const [zoom, setZoom] = useState(true);
  const [tab, setTab] = useState("skylines");
  const [terrain, setTerrain] = useState(null);
  const [terrainErr, setTerrainErr] = useState(null);

  useEffect(() => {
    const onPopState = () => setPage(currentPage());
    addEventListener('popstate', onPopState);
    return () => removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    document.title = page === 'about' ? 'About Sun Shade' : 'Sun Shade';
    if (page === 'about') document.getElementById('intro').hidden = true;
    const raf = requestAnimationFrame(() => {
      document.getElementById(page === 'about' ? 'about-main' : 'compare-main')?.focus({ preventScroll: true });
      if (location.hash === '#about-sources') document.getElementById('about-sources')?.scrollIntoView();
      else window.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(raf);
  }, [page]);
  const navigate = (nextPage) => {
    const path = routeUrl(nextPage);
    if (location.pathname !== path || location.hash) history.pushState(null, '', path + location.search);
    setPage(nextPage);
  };
  const followRoute = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(event.currentTarget.pathname === routeUrl('about') ? 'about' : 'compare');
  };
  const compareHref = routeUrl('compare');

  const dateMin = iso(t0 + MAX_DELAY_D * DAY);
  const dateMax = iso(t0 + data.ephemeris.count * H - (MAX_DELAY_D + 30) * DAY);
  const iPlanned = (Date.parse(`${date}T00:00:00Z`) - t0) / H, i0 = iPlanned + delay * 24;
  const when = fmtDate(t0 + i0 * H, { weekday: "short", year: "numeric" });
  const plannedStats = useMemo(() => picks.map(id => ({ onTime: windowMetrics(vis(id), iPlanned).sunlit, d: verdictDelay(vis(id), iPlanned) })), [picks, iPlanned]);
  const stats = useMemo(() => picks.map((id, index) => ({ id, m: windowMetrics(vis(id), i0), ...plannedStats[index] })), [picks, i0, plannedStats]);
  const detailIndex = useDeferredValue(i0);
  const said = narrate(delay, stats.map((s) => ({ name: sites[s.id].name, now: s.m.sunlit, onTime: s.onTime, d: s.d })));

  useEffect(() => {
    initialTerrain().then(setTerrain).catch(err => setTerrainErr(err.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showValidation = () => { setTab("validation"); requestAnimationFrame(() => document.getElementById("details")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" })); };
  const n = Math.abs(delay);
  const slip = delay === 0 ? "ON TIME" : delay > 0 ? `SLIP +${n} D` : `EARLY −${n} D`;

  return (
    <div className="shell">
      <nav className="site-nav" aria-label="Main navigation">
        <a className="nav-wordmark" href={compareHref} onClick={followRoute}>SUN SHADE</a>
        <div><a href={compareHref} onClick={followRoute} aria-current={page === 'compare' ? 'page' : undefined}>Compare sites</a><a href={routeUrl('about')} onClick={followRoute} aria-current={page === 'about' ? 'page' : undefined}>About</a></div>
      </nav>
      {page === 'about' && <About compareHref={compareHref} onCompare={() => navigate('compare')} onCompareLink={followRoute} />}
      <div hidden={page === 'about'}>
        <header className="top">
          <div className="min-w-0 flex-1 basis-80">
            <h1 className="brand glow">▓▒░ SUN SHADE ░▒▓</h1>
            <p className="tag">Sunlight and Earth contact at the lunar south pole, and what a launch slip does to them</p>
          </div>
          <div className="tools">
            <LandingDatePicker value={date} min={dateMin} max={dateMax} onChange={setDate} />
            {data.mock && <span className="mock" title="Every number on this screen is a placeholder until real data replaces it">MOCK DATA</span>}
            <Button type="button" variant="link" size="sm" onClick={showValidation}>Validation</Button>
          </div>
        </header>

        <section className="hud panel slipbar">
          <label htmlFor="slip" className="hud-label shrink-0">LAUNCH SLIP</label>
          <div className="slip-track">
            <Slider
              id="slip"
              aria-label="Launch delay in days"
              min={-MAX_DELAY_D}
              max={MAX_DELAY_D}
              step={1}
              value={[delay]}
              onPointerDown={() => setInteracting(true)}
              onPointerUp={() => setInteracting(false)}
              onLostPointerCapture={() => setInteracting(false)}
              onPointerCancel={() => setInteracting(false)}
              onValueCommit={() => setInteracting(false)}
              onValueChange={([x]) => setDelay(x)}
            />
            <div className="ticks" aria-hidden="true"><span>−60 D</span><span>−30</span><span>0</span><span>+30</span><span>+60 D</span></div>
          </div>
          <output htmlFor="slip" className="slipout glow">{slip} · LANDS {when.toUpperCase()}</output>
        </section>

        <p className="stars-say" aria-live="off"><b>✦ STARS //</b><span>{said}<i className="cursor" aria-hidden="true" /></span></p>

        <main className="console" id="compare-main" tabIndex={-1}>
          <SiteCard n={1} st={stats[0]} onPick={(id) => setPicks([id, picks[1]])} />
          <ShadowMap picks={picks} i0={i0} when={when} zoom={zoom} onZoom={() => setZoom(!zoom)} terrain={terrain} terrainErr={terrainErr} interacting={interacting} />
          <SiteCard n={2} st={stats[1]} onPick={(id) => setPicks([picks[0], id])} />
        </main>

        <DetailTabs picks={picks} i0={detailIndex} tab={tab} onTab={setTab} />
        <p className="foot">Half sunlight = 360 of 720 hours. Verdicts test delays of 0 to {MAX_DELAY_D} days from the planned date. Landing at 00:00 UTC. Hover the charts for detail.</p>
      </div>
    </div>
  );
}
