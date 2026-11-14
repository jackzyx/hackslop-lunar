import { useEffect, useMemo, useRef, useState } from "react";
import { windowMetrics, verdictDelay, MAX_DELAY_D } from "@/domain/metrics.js";
import { addCustomSite, removeCustomSite, restoreCustomSites, customSites, MAX_CUSTOM } from "@/lib/custom-sites.js";
import { initialTerrain } from '@/terrain/startup.js';
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
import HelpTip from '@/components/HelpTip';
import AmbientStars from '@/components/AmbientStars';
import { currentPage, isPolicyPage, pageForPath, routeUrl } from "@/lib/routes.js";

function focusPage(page, animate = false) {
  const sources = page === 'about' && location.hash === '#about-sources';
  const target = document.getElementById(sources ? 'about-sources' : `${page}-main`);
  target?.focus({ preventScroll: true });
  if (sources) target?.scrollIntoView({ behavior: animate && !reducedMotion() ? 'smooth' : 'auto' });
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
    if (page === nextPage) focusPage(nextPage, true);
    else setPage(nextPage);
  };
  const followRoute = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const { pathname, hash } = event.currentTarget;
    const nextPage = pageForPath(pathname);
    if (!nextPage || (hash && hash !== '#about-sources' && pathname === location.pathname)) return;
    event.preventDefault();
    navigate(nextPage, hash);
  };

  return (
    <>
      <AmbientStars />
      <div className="shell" id="site-top">
        {policyPage && <PolicyPage page={page} onRoute={followRoute} />}
        {plannerReady && page === 'about' && <About onCompare={() => navigate('compare')} onRoute={followRoute} paused={paused} />}
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
  const slipTrack = useRef(null);
  const [interacting, setInteracting] = useState(false);
  const [picks, setPicks] = useState(["A", "B"]);
  const [zoom, setZoom] = useState(true);
  const [tab, setTab] = useState("skylines");
  const [terrain, setTerrain] = useState(null);
  const [terrainErr, setTerrainErr] = useState(null);
  const [customKey, setCustomKey] = useState(0); // bumps when custom sites are added or removed

  useEffect(() => {
    const track = slipTrack.current;
    let accumulated = 0;
    let lastWheel = 0;
    const scrollSlip = (event) => {
      if (event.ctrlKey) return; // Preserve trackpad pinch zoom.
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!delta) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheel > 200 || Math.sign(delta) !== Math.sign(accumulated)) accumulated = 0;
      lastWheel = now;
      accumulated += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? track.clientWidth : 1);
      const days = Math.trunc(accumulated / 40);
      if (days) {
        accumulated -= days * 40;
        setDelay(value => Math.max(-MAX_DELAY_D, Math.min(MAX_DELAY_D, value + days)));
      }
    };
    track.addEventListener('wheel', scrollSlip, { passive: false });
    return () => track.removeEventListener('wheel', scrollSlip);
  }, []);

  // A click on the map: build the site, show it as site 2. Returns an error message or null.
  const placeSite = (lat, lon, name) => {
    try {
      const spare = customSites().find((s) => !picks.includes(s.id));
      if (customSites().length >= MAX_CUSTOM && spare) removeCustomSite(spare.id); // full: drop the oldest one not on screen
      const id = addCustomSite(terrain, lat, lon, name); setPicks([picks[0], id]); setCustomKey((k) => k + 1); return null;
    }
    catch (e) { return e.message; }
  };
  const removeSite = (id) => {
    removeCustomSite(id);
    setPicks((p) => p.map((x, k) => (x === id ? (["A", "B", "C"].find((s) => s !== p[1 - k])) : x)));
    setCustomKey((k) => k + 1);
  };

  const dateMin = iso(t0 + MAX_DELAY_D * DAY);
  const dateMax = iso(t0 + data.ephemeris.count * H - (MAX_DELAY_D + 30) * DAY);
  const shiftSlip = (days) => setDelay(current => Math.max(-MAX_DELAY_D, Math.min(MAX_DELAY_D, current + days)));
  const iPlanned = (Date.parse(`${date}T00:00:00Z`) - t0) / H, i0 = iPlanned + delay * 24;
  const when = fmtDate(t0 + i0 * H, { weekday: "short", year: "numeric" });
  const plannedStats = useMemo(() => picks.map(id => ({ onTime: windowMetrics(vis(id), iPlanned).sunlit, d: verdictDelay(vis(id), iPlanned) })), [picks, iPlanned]);
  const stats = useMemo(() => picks.map((id, index) => ({ id, m: windowMetrics(vis(id), i0), ...plannedStats[index] })), [picks, i0, plannedStats]);

  useEffect(() => {
    initialTerrain().then((t) => { restoreCustomSites(t); setTerrain(t); setCustomKey((k) => k + 1); }).catch(err => setTerrainErr(err.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showValidation = () => { setTab("validation"); requestAnimationFrame(() => document.getElementById("details")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" })); };
  const n = Math.abs(delay);
  const slip = delay === 0 ? "ON TIME" : delay > 0 ? `SLIP +${n} D` : `EARLY −${n} D`;

  return (
      <div hidden={hidden}>
        <header className="top">
          <div className="min-w-0 flex-1 basis-80">
            <h1 className="brand glow">
              {/* mark: a half-lit disc (sun and shade) inside a targeting ring */}
              <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor">
                <circle className="brand-orbit" cx="16" cy="16" r="14" strokeWidth="1.2" strokeDasharray="3 2.5" opacity=".6" />
                <circle cx="16" cy="16" r="9" strokeWidth="1.6" />
                <path d="M16 7a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
                <path d="M0.5 16h3M28.5 16h3M16 0.5v3M16 28.5v3" strokeWidth="1.6" />
              </svg>
              <span>SUN SHADE</span>
            </h1>
            <p className="tag">Sunlight and Earth contact at the lunar south pole, and what a launch slip does to them</p>
          </div>
          <div className="tools">
            <LandingDatePicker value={date} min={dateMin} max={dateMax} onChange={setDate} />
            {data.mock && <span className="mock" title="Every number on this screen is a placeholder until real data replaces it">MOCK DATA</span>}
            <Button type="button" variant="link" size="sm" onClick={showValidation}>Validation</Button>
          </div>
        </header>

        <section className="hud panel slipbar">
          <div className="hud-label shrink-0"><label htmlFor="slip">LAUNCH SLIP</label><HelpTip label="launch slip">Days earlier or later than your planned landing date. Drag or scroll the slider, or scroll the Sun/Earth bars below. The planned date stays fixed.</HelpTip></div>
          <div className="slip-track" ref={slipTrack} title="Scroll to adjust launch slip">
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
          <SiteCard n={1} st={stats[0]} onPick={(id) => setPicks([id, picks[1]])} onRemove={removeSite} />
          <ShadowMap picks={picks} i0={i0} when={when} zoom={zoom} onZoom={() => setZoom(!zoom)} terrain={terrain} terrainErr={terrainErr} interacting={interacting} onPlace={placeSite} />
          <SiteCard n={2} st={stats[1]} onPick={(id) => setPicks([picks[0], id])} onRemove={removeSite} />
        </main>

        <DetailTabs picks={picks} i0={i0} tab={tab} onTab={setTab} customKey={customKey} terrain={terrain} iPlanned={iPlanned} dateMax={dateMax} onShiftDate={shiftSlip} onLand={(d) => { setDate(d); setDelay(0); }} />
        <p className="foot">Half sunlight = 360 of 720 hours. Verdicts test delays of 0 to {MAX_DELAY_D} days from the planned date. Landing at 00:00 UTC. Hover the charts for detail.</p>
      </div>
  );
}
