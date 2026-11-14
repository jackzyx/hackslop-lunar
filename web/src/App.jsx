import { useEffect, useRef, useState } from "react";
import { windowMetrics, verdictDelay, MAX_DELAY_D } from "@/metrics.js";
import { terrainFrom } from "@/shadow.js";
import { playIntro } from "@/intro.js";
import { narrate } from "@/narrator.js";
import { data, sites, vis, sunAt, t0, H, DAY, iso, fmtDate, reducedMotion } from "@/lib/data.js";
import { fmtDeg, worst, done, validation } from "@/lib/validation.js";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import SiteCard from "@/components/SiteCard";
import ShadowMap from "@/components/ShadowMap";
import DetailTabs from "@/components/DetailTabs";
import About from "@/components/About";

// Planned dates must leave room for the whole slider range plus the 30-day window.
const DATE_MIN = iso(t0 + MAX_DELAY_D * DAY), DATE_MAX = iso(t0 + data.ephemeris.count * H - (MAX_DELAY_D + 30) * DAY);

export default function App() {
  const [page, setPage] = useState(() => location.hash.startsWith('#about') ? 'about' : 'compare');
  const [date, setDate] = useState("2026-11-20");
  const [delay, setDelay] = useState(0);
  const [picks, setPicks] = useState(["A", "B"]);
  const [zoom, setZoom] = useState(true);
  const [tab, setTab] = useState("skylines");
  const [terrain, setTerrain] = useState(null);
  const [terrainErr, setTerrainErr] = useState(null);

  useEffect(() => {
    const onHash = () => setPage(location.hash.startsWith('#about') ? 'about' : 'compare');
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    document.title = page === 'about' ? 'About Long Shadow' : 'Long Shadow';
    if (page === 'about') document.getElementById('intro').hidden = true;
    const raf = requestAnimationFrame(() => {
      document.getElementById(page === 'about' ? 'about-main' : 'compare-main')?.focus({ preventScroll: true });
      if (location.hash === '#about-sources') document.getElementById('about-sources')?.scrollIntoView();
      else window.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(raf);
  }, [page]);
  const showCompare = () => { location.hash = 'compare'; };

  const iPlanned = (Date.parse(`${date}T00:00:00Z`) - t0) / H, i0 = iPlanned + delay * 24;
  const when = fmtDate(t0 + i0 * H, { weekday: "short", year: "numeric" });
  const stats = picks.map((id) => { const v = vis(id); return { id, m: windowMetrics(v, i0), onTime: windowMetrics(v, iPlanned).sunlit, d: verdictDelay(v, iPlanned) }; });
  const said = narrate(delay, stats.map((s) => ({ name: sites[s.id].name, now: s.m.sunlit, onTime: s.onTime, d: s.d })));

  // STARS intro for the current landing; latest state through a ref so the button never plays a stale scene.
  const live = useRef();
  live.current = { i0, picks, terrain };
  const intro = (t = live.current.terrain) => {
    const { i0: i, picks: p } = live.current, ms = t0 + i * H;
    playIntro({ ms, sun: sunAt(p[0], i), terrain: t, picks: p.map((id) => sites[id]), when: fmtDate(ms, { year: "numeric" }) });
  };
  useEffect(() => {
    fetch("terrain_500m.bin")
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((b) => { const t = terrainFrom(b); setTerrain(t); return t; })
      .catch((err) => { setTerrainErr(err.message); return null; })
      .then((t) => (reducedMotion() || location.hash.startsWith('#about') ? (document.getElementById("intro").hidden = true) : intro(t)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showValidation = () => { setTab("validation"); requestAnimationFrame(() => document.getElementById("details")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" })); };
  const n = Math.abs(delay);
  const slip = delay === 0 ? "ON TIME" : delay > 0 ? `SLIP +${n} D` : `EARLY −${n} D`;

  return (
    <div className="shell">
      <nav className="site-nav" aria-label="Main navigation">
        <a className="nav-wordmark" href="#compare">LONG SHADOW</a>
        <div><a href="#compare" aria-current={page === 'compare' ? 'page' : undefined}>Compare sites</a><a href="#about" aria-current={page === 'about' ? 'page' : undefined}>About</a></div>
      </nav>
      {page === 'about' && <About terrain={terrain} i0={i0} site={picks[0]} onCompare={showCompare} />}
      <div hidden={page === 'about'}>
      <header className="top">
        <div className="min-w-0 flex-1 basis-80">
          <h1 className="brand glow">▓▒░ LONG SHADOW ░▒▓</h1>
          <p className="tag">Sunlight and Earth contact at the lunar south pole, and what a launch slip does to them</p>
        </div>
        <div className="tools">
          <label className="hud-label flex items-center gap-2">PLANNED LANDING
            <input type="date" className="date" required min={DATE_MIN} max={DATE_MAX} value={date}
              onChange={(ev) => { const x = ev.target.value; if (x && x >= DATE_MIN && x <= DATE_MAX) setDate(x); }} />
          </label>
          <Button variant="outline" size="sm" onClick={() => intro()}>✦ STARS INTRO</Button>
          {data.mock && <span className="mock" title="Every number on this screen is a placeholder until real data replaces it">MOCK DATA</span>}
          <button type="button" className={`pill ${done.length ? "ok" : ""}`} onClick={showValidation}
            title={done.length ? `Sun and Earth angles, worst of ${done.length} site and body rows; pass mark ${validation.pass_deg}°` : ""}>
            {done.length ? `✓ WITHIN ${fmtDeg(worst)} OF NASA JPL HORIZONS` : "HORIZONS CHECK: NOT YET RUN"}
          </button>
        </div>
      </header>

      <section className="hud panel slipbar">
        <label htmlFor="slip" className="hud-label shrink-0">LAUNCH SLIP</label>
        <div className="flex-1">
          <Slider id="slip" aria-label="Launch delay in days" min={-MAX_DELAY_D} max={MAX_DELAY_D} step={1} value={[delay]} onValueChange={([x]) => setDelay(x)} />
          <div className="ticks" aria-hidden="true"><span>−60 D</span><span>−30</span><span>0</span><span>+30</span><span>+60 D</span></div>
        </div>
        <output htmlFor="slip" className="slipout glow">{slip} · LANDS {when.toUpperCase()}</output>
      </section>

      <p className="stars-say" aria-live="off"><b>✦ STARS //</b><span>{said}<i className="cursor" aria-hidden="true" /></span></p>

      <main className="console" id="compare-main" tabIndex={-1}>
        <SiteCard n={1} st={stats[0]} i0={i0} onPick={(id) => setPicks([id, picks[1]])} />
        <ShadowMap picks={picks} i0={i0} when={when} zoom={zoom} onZoom={() => setZoom(!zoom)} terrain={terrain} terrainErr={terrainErr} />
        <SiteCard n={2} st={stats[1]} i0={i0} onPick={(id) => setPicks([picks[0], id])} />
      </main>

      <DetailTabs picks={picks} i0={i0} tab={tab} onTab={setTab} />
      <p className="foot">Half sunlight = 360 of 720 hours. Verdicts test delays of 0 to {MAX_DELAY_D} days from the planned date. Landing at 00:00 UTC. Mast height 2 m. Hover the charts for detail.</p>
      </div>
    </div>
  );
}
