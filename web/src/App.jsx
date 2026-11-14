import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { windowMetrics, verdictDelay, MAX_DELAY_D } from "@/domain/metrics.js";
import { initialTerrain } from '@/terrain/startup.js';
import { narrate } from "@/domain/narrator.js";
import { data, sites, vis, t0, H, DAY, iso, fmtDate, reducedMotion, loadPlannerData } from "@/lib/data.js";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import SiteCard from "@/components/SiteCard";
import SiteFooter from "@/components/SiteFooter";
import PolicyPage, { policyTitles } from "@/components/PolicyPage";
import ShadowMap from "@/components/ShadowMap";
import DetailTabs from "@/components/DetailTabs";
import About from "@/components/About";
import LandingDatePicker from "@/components/LandingDatePicker";
import AmbientStars from '@/components/AmbientStars';
import Stars from "@/components/Stars";
import { DEFAULT_PREFS } from "@/domain/screening.js";
import { checkPatch } from "@/stars/actions.js";
import { currentPage, isPolicyPage, pageForPath, routeUrl } from "@/lib/routes.js";

function focusPage(page) {
  const sources = page === 'about' && location.hash === '#about-sources';
  const target = document.getElementById(sources ? 'about-sources' : `${page}-main`);
  target?.focus({ preventScroll: true });
  if (sources) target?.scrollIntoView();
  else window.scrollTo(0, 0);
}

export default function App() {
  const [page, setPage] = useState(currentPage);
  const [paused, setPaused] = useState(false);
  const [plannerReady, setPlannerReady] = useState(() => Boolean(data));
  const [plannerError, setPlannerError] = useState(false);
  const policyPage = isPolicyPage(page);

  useEffect(() => {
    const onPopState = () => setPage(currentPage());
    addEventListener('popstate', onPopState);
    return () => removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    if (policyPage || plannerReady) return;
    let active = true;
    setPlannerError(false);
    loadPlannerData().then(() => {
      if (active) setPlannerReady(true);
    }).catch(() => {
      if (active) setPlannerError(true);
    });
    return () => { active = false; };
  }, [page, policyPage, plannerReady]);
  useEffect(() => {
    document.title = policyPage ? `${policyTitles[page]} | Sun Shade` : page === 'about' ? 'About Sun Shade' : 'Sun Shade';
    if (page !== 'compare') document.getElementById('intro').hidden = true;
    const raf = requestAnimationFrame(() => focusPage(page));
    return () => cancelAnimationFrame(raf);
  }, [page, policyPage, plannerReady]);
  const navigate = (nextPage, hash = '') => {
    const path = routeUrl(nextPage);
    if (location.pathname !== path || location.hash !== hash) history.pushState(null, '', path + location.search + hash);
    if (page === nextPage) focusPage(nextPage);
    else setPage(nextPage);
  };
  const followRoute = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const { pathname, hash } = event.currentTarget;
    const nextPage = pageForPath(pathname);
    if (!nextPage || (hash && pathname === location.pathname)) return;
    event.preventDefault();
    navigate(nextPage, hash);
  };
  const compareHref = routeUrl('compare');
  const aboutHref = routeUrl('about');

  return (
    <>
      <AmbientStars />
      <div className="shell">
        <nav className="site-nav" aria-label="Main navigation">
          <a id="site-top" className="nav-wordmark" href={compareHref} onClick={followRoute}>SUN SHADE</a>
          <div>
            <a href={compareHref} onClick={followRoute} aria-current={page === 'compare' ? 'page' : undefined}>Compare</a>
            <a href={aboutHref} onClick={followRoute} aria-current={page === 'about' ? 'page' : undefined}>About</a>
          </div>
        </nav>
        {policyPage && <PolicyPage page={page} onRoute={followRoute} />}
        {plannerReady && page === 'about' && <About onCompare={() => navigate('compare')} paused={paused} />}
        {plannerReady && <Planner hidden={page !== 'compare'} />}
        {!policyPage && !plannerReady && <main className="policy-page" role="status">{plannerError ? 'Could not load the planner. Refresh to try again.' : 'Loading planner.'}</main>}
        <SiteFooter page={page} onRoute={followRoute} paused={paused} onToggleAnimations={plannerReady && page === 'about' ? () => setPaused(value => !value) : undefined} />
      </div>
    </>
  );
}

function Planner({ hidden }) {
  const [date, setDate] = useState("2026-11-20");
  const [delay, setDelay] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const [picks, setPicks] = useState(["A", "B"]);
  const [zoom, setZoom] = useState(true);
  const [tab, setTab] = useState("skylines");
  const [terrain, setTerrain] = useState(null);
  const [terrainErr, setTerrainErr] = useState(null);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [undoStack, setUndoStack] = useState([]);

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

  // STARS may change only these fields, only through checkPatch, and each change can be undone
  // field by field (later manual changes to other fields are kept).
  const current = { date, delay, picks, prefs, zoom };
  const setters = { date: setDate, delay: setDelay, picks: setPicks, prefs: setPrefs, zoom: setZoom };
  const starsApply = (patch) => {
    const errors = checkPatch(patch, { siteIds: data.sites.map((s) => s.id), dateMin, dateMax });
    if (errors.length) return errors;
    setUndoStack((u) => [...u.slice(-19), Object.fromEntries(Object.keys(patch).map((k) => [k, current[k]]))]);
    for (const [k, v] of Object.entries(patch)) setters[k](v);
    return [];
  };
  const starsUndo = () => {
    const prev = undoStack.at(-1);
    if (!prev) return;
    for (const [k, v] of Object.entries(prev)) setters[k](v);
    setUndoStack((u) => u.slice(0, -1));
  };
  const starsFocus = () => { setZoom(true); requestAnimationFrame(() => document.getElementById("compare-main")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" })); };
  const starsCtx = { sites: data.sites, vis, count: data.ephemeris.count, t0, iPlanned, delay, picks, prefs, dateMin, dateMax };

  const showValidation = () => { setTab("validation"); requestAnimationFrame(() => document.getElementById("details")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" })); };
  const n = Math.abs(delay);
  const slip = delay === 0 ? "ON TIME" : delay > 0 ? `SLIP +${n} D` : `EARLY −${n} D`;

  return (
      <div hidden={hidden}>
        <header className="top">
          <div className="min-w-0 flex-1 basis-80">
            <h1 className="brand glow">SUN SHADE</h1>
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

        <main className="console" id="compare-main" tabIndex={-1}>
          <SiteCard n={1} st={stats[0]} onPick={(id) => setPicks([id, picks[1]])} />
          <ShadowMap picks={picks} i0={i0} when={when} zoom={zoom} onZoom={() => setZoom(!zoom)} terrain={terrain} terrainErr={terrainErr} interacting={interacting} />
          <SiteCard n={2} st={stats[1]} onPick={(id) => setPicks([picks[0], id])} />
        </main>

        <DetailTabs picks={picks} i0={detailIndex} tab={tab} onTab={setTab} />
        <p className="foot">Half sunlight = 360 of 720 hours. Verdicts test delays of 0 to {MAX_DELAY_D} days from the planned date. Landing at 00:00 UTC. Hover the charts for detail.</p>
        <Stars ctx={starsCtx} stateKey={JSON.stringify([date, delay, picks, prefs])} live={said} onApply={starsApply} onUndo={starsUndo} canUndo={undoStack.length > 0} onFocus={starsFocus} />
      </div>
  );
}
