import { useEffect, useRef, useState } from 'react';
import { shadeView, paint } from '@/terrain/shadow.js';
import { data, sunAt } from '@/lib/data.js';
import { sourceGroups } from '@/lib/sources.js';
import { Button } from '@/components/ui/button';

function TerrainPortrait({ terrain, i0, site }) {
  const canvas = useRef(null);
  useEffect(() => {
    if (!terrain) return;
    const ctx = canvas.current.getContext('2d'), pixels = ctx.createImageData(600, 600);
    paint(shadeView(terrain, sunAt(site, i0), { cx: 0, cy: 0, half: 170 }, 600), pixels.data);
    ctx.putImageData(pixels, 0, 0);
  }, [terrain, i0, site]);
  return <figure className="about-terrain">
    <div className="about-orbit" aria-hidden="true" />
    <canvas ref={canvas} width="600" height="600" role="img" aria-label="NASA lunar south-pole terrain shaded for the selected scenario" />
    <figcaption>NASA LOLA terrain · {data.mock ? 'illustrative demo lighting' : 'selected landing instant'}<br />0° longitude up · 500 m terrain sampling</figcaption>
  </figure>;
}

export default function About({ terrain, i0, site, onCompare }) {
  const root = useRef(null), [query, setQuery] = useState(''), [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.current.classList.add('has-observer');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
    }), { threshold: 0.08 });
    root.current.querySelectorAll('.about-reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  const groups = sourceGroups.map(group => ({ ...group, entries: group.entries.filter(entry => entry.join(' ').toLowerCase().includes(query.toLowerCase().trim())) }));
  const count = groups.reduce((n, group) => n + group.entries.length, 0);
  return <main ref={root} className={`about-page ${paused ? 'about-paused' : ''}`} id="about-main" tabIndex={-1}>
    <section className="about-hero">
      <div>
        <h1>Find the light<br /><em>when plans change.</em></h1>
        <p className="about-lead">The same landing site can tell a different story on a different day.</p>
        <p>Sun Shade helps you compare sunlight and Earth visibility at the Moon’s south pole. Choose two sites, move the landing date, and see what the terrain hides.</p>
        <div className="about-actions"><Button onClick={onCompare}>COMPARE LANDING SITES →</Button><a href="#about-sources">Explore the sources ↓</a></div>
        {data.mock && <p className="about-status">The current scenario table is marked as demo data. Explore the interface, but do not use its displayed scenarios as mission predictions.</p>}
      </div>
      <TerrainPortrait terrain={terrain} i0={i0} site={site} />
    </section>

    <section className="about-section about-reveal" aria-labelledby="about-features">
      <div className="about-section-copy"><h2 id="about-features">Follow a date change<br />through the whole picture.</h2><p>The planner links the controls, map and charts. The same scenario drives both site cards, so you can compare the trade-offs directly.</p><Button variant="outline" onClick={onCompare}>TRY A LAUNCH DELAY →</Button></div>
      <ol className="about-feature-list">
        <li><b>Choose the alternatives</b><p>Two site selectors and one landing date put both options on the same footing.</p></li>
        <li><b>Move the schedule</b><p>The delay slider shifts arrival earlier or later. Sunlight hours, dark gaps and Earth visibility update together.</p></li>
        <li><b>See why the answer changes</b><p>The shadow map explains the geography. Horizon panoramas and hourly timelines explain the visible and hidden intervals.</p></li>
      </ol>
    </section>

    <section className="about-method about-reveal" aria-labelledby="about-method">
      <h2 id="about-method">From lunar measurements<br />to a view you can compare.</h2>
      <div className="about-pipeline" aria-label="Science pipeline"><span>NASA LOLA<small>terrain & horizon</small></span><i aria-hidden="true">+</i><span>SPICE / DE440<small>Sun & Earth positions</small></span><i aria-hidden="true">→</i><span>Visibility windows<small>site cards, charts & map</small></span></div>
      <div className="about-method-notes"><p>The Python pipeline prepares the positions and local terrain horizons. The browser turns those tables into a site comparison. The map uses terrain averaged to 500 m; it is a spatial explanation, not the source of the card metrics.</p><p>JPL Horizons supplies an independent angle check. Terrain-resolution comparison and a published illumination benchmark remain separate checks; agreement in body positions alone does not validate the whole model.</p></div>
    </section>

    <section className="about-boundaries about-reveal" aria-labelledby="about-limits">
      <div><h2 id="about-limits">A first look for planners.<br />An explanation for everyone.</h2><p>Mission analysts and students can explore a shortlist before detailed engineering analysis. In a classroom, the same screen connects a ridge on the map to a gap on the timeline.</p><p>The static app can be served locally for offline use. Its source is available under the MIT licence.</p></div>
      <div className="hud about-limit-panel"><h3>What the comparison means</h3><p>Sunlight is geometric visibility, not available electrical power. Earth contact is line of sight, not a radio-link budget.</p><ul><li>No power or thermal model.</li><li>No landing-hazard or slope assessment.</li><li>Curated sites; no custom coordinates.</li><li>Landing dates at 00:00 UTC.</li></ul><p>Measured validation results are shown in the planner’s Validation tab, with unfinished checks labelled.</p></div>
    </section>

    <section className="about-sources about-reveal" id="about-sources" aria-labelledby="sources-heading">
      <div className="about-source-heading"><div><h2 id="sources-heading">Check the sources.</h2><p>The data, imagery, software and references behind Sun Shade. Each entry explains what it contributes.</p></div><a href="https://github.com/jackzyx/hackslop-lunar" target="_blank" rel="noreferrer">View the code ↗</a></div>
      <label className="about-search">Find a source<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try LOLA, Horizons, imagery or React" /></label>
      <p className="about-source-count" role="status">{count} {count === 1 ? 'source' : 'sources'}{query ? ` matching “${query}”` : ' in the bibliography'}</p>
      {groups.map((group, i) => group.entries.length > 0 && <details className="about-source-group" key={`${group.title}-${Boolean(query)}`} open={Boolean(query) || i === 0}>
        <summary>{group.title}<span>{group.entries.length}</span></summary>
        <ul>{group.entries.map(([title, text, url]) => <li key={url}><a href={url} target="_blank" rel="noreferrer">{title} <span aria-hidden="true">↗</span></a><p>{text}</p></li>)}</ul>
      </details>)}
      {count === 0 && <p>No sources match that search. <button onClick={() => setQuery('')}>Show all sources</button></p>}
      <div className="about-disclosure"><h3>Built with real data, credited openly.</h3><p>Lunar imagery and relief geometry come from NASA data, not image generation. Bibliography links require an internet connection; the bundled app assets do not.</p><p>The 80 mm STEP/STL relief is an appearance prototype. A motorized turntable is exploratory hardware, not a completed browser feature.</p></div>
    </section>
    <footer className="about-footer"><span>Sun Shade · NASA Space Apps / HackAthlone 2026</span><button onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? 'Resume animations' : 'Pause animations'}</button><a href="#compare" onClick={onCompare}>Back to the comparison ↑</a></footer>
  </main>;
}
