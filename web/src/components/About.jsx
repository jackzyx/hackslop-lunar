import { useEffect, useRef, useState } from 'react';
import { data } from '@/lib/data.js';
import { projectRepository, sourceGroups } from '@/lib/sources.js';
import { Button } from '@/components/ui/button';
import MoonGlobe from '@/components/MoonGlobe';

export default function About({ onCompare, paused }) {
  const root = useRef(null), [query, setQuery] = useState('');
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
      <MoonGlobe paused={paused} />
    </section>

    <section className="about-section about-reveal" aria-labelledby="about-features">
      <div className="about-section-copy"><h2 id="about-features">Follow a date change<br />through the whole picture.</h2><p>The planner links the controls, map and charts. The same scenario drives both site cards, so you can compare the trade-offs directly.</p><Button variant="outline" onClick={onCompare}>TRY A LAUNCH DELAY →</Button></div>
      <ol className="about-feature-list">
        <li><b>Choose the alternatives</b><p>Two site selectors and one landing date put both options on the same footing.</p></li>
        <li><b>Move the schedule</b><p>The delay slider shifts arrival earlier or later. Sunlight hours, dark gaps and Earth visibility update together.</p></li>
        <li><b>See why the answer changes</b><p>The shadow map explains the geography. Horizon panoramas and hourly timelines explain the visible and hidden intervals.</p></li>
        <li><b>Drop your own site</b><p>Click anywhere on the map within 160 km of the pole, or right-click to name it. The browser computes its skyline from the terrain and compares it with any other site.</p></li>
        <li><b>Find the best day to land</b><p>The Best landing days tab ranks every landing date in the next year for most sunlight, most Earth contact, or the best of both. One click plans it.</p></li>
      </ol>
    </section>

    <section className="about-method about-reveal" aria-labelledby="about-method">
      <h2 id="about-method">From lunar measurements<br />to a view you can compare.</h2>
      <div className="about-pipeline" aria-label="Science pipeline"><span>NASA LOLA<small>terrain & horizon</small></span><i aria-hidden="true">+</i><span>SPICE / DE440<small>Sun & Earth positions</small></span><i aria-hidden="true">→</i><span>Visibility windows<small>site cards, charts & map</small></span></div>
      <div className="about-method-notes"><p>The Python pipeline prepares the positions and local terrain horizons. The browser turns those tables into a site comparison. The map uses terrain averaged to 500 m. For curated sites it explains the geography; custom sites take their skyline from it, which the Validation tab compares with the 80 m results.</p><p>JPL Horizons supplies an independent angle check. Terrain-resolution comparison and a published illumination benchmark remain separate checks; agreement in body positions alone does not validate the whole model.</p></div>
    </section>

    <section className="about-boundaries about-reveal" aria-labelledby="about-limits">
      <div><h2 id="about-limits">A first look for planners.<br />An explanation for everyone.</h2><p>Mission analysts and students can explore a shortlist before detailed engineering analysis. In a classroom, the same screen connects a ridge on the map to a gap on the timeline.</p><p>The static app can be served locally for offline use. Its source is available under the MIT licence.</p></div>
      <div className="hud about-limit-panel"><h3>What the comparison means</h3><p>Sunlight is geometric visibility, not available electrical power. Earth contact is line of sight, not a radio-link budget.</p><ul><li>No power or thermal model.</li><li>No landing-hazard or slope assessment.</li><li>Custom sites use coarser 500 m terrain and are screening estimates.</li><li>Landing dates at 00:00 UTC.</li></ul><p>Measured validation results are shown in the planner’s Validation tab, with unfinished checks labelled.</p></div>
    </section>

    <section className="about-faq about-reveal" aria-labelledby="about-faq">
      <h2 id="about-faq">Questions.</h2>
      <div className="about-faq-list">{faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
    </section>

    <section className="about-sources about-reveal" id="about-sources" aria-labelledby="sources-heading" tabIndex={-1}>
      <div className="about-source-heading"><div><h2 id="sources-heading">Check the sources.</h2><p>The data, imagery, software and references behind Sun Shade. Each entry explains what it contributes.</p></div><a href={projectRepository} target="_blank" rel="noreferrer">View the code ↗</a></div>
      <label className="about-search">Find a source<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try LOLA, Horizons, imagery or React" /></label>
      <p className="about-source-count" role="status">{count} {count === 1 ? 'source' : 'sources'}{query ? ` matching “${query}”` : ' in the bibliography'}</p>
      {groups.map((group, i) => group.entries.length > 0 && <details className="about-source-group" key={`${group.title}-${Boolean(query)}`} open={Boolean(query) || i === 0}>
        <summary>{group.title}<span>{group.entries.length}</span></summary>
        <ul>{group.entries.map(([title, text, url]) => <li key={url}><a href={url} target="_blank" rel="noreferrer">{title} <span aria-hidden="true">↗</span></a><p>{text}</p></li>)}</ul>
      </details>)}
      {count === 0 && <p>No sources match that search. <button onClick={() => setQuery('')}>Show all sources</button></p>}
    </section>
  </main>;
}

const faq = [
  ['Is this a NASA tool?', 'No. Sun Shade was built by a team at HackAthlone 2026, a local event of the NASA International Space Apps Challenge. It uses NASA data, but NASA does not endorse it.'],
  ['Where do the numbers come from?', 'Sun and Earth positions come from NASA/JPL ephemerides (DE440) through SPICE, computed hourly for 2025 to 2030. Skylines come from NASA LOLA terrain. The browser combines the two to count the hours each site sees the Sun and Earth.'],
  ['How accurate is it?', 'Sun and Earth directions agree with JPL Horizons; the Validation tab shows the comparison. The bigger uncertainty is terrain resolution and what is not modelled: power, thermal, radio links and landing hazards. Treat results as a first look, not mission data.'],
  ['Why 30 days?', 'One lunar day is about 29.5 Earth days, so a 30-day window covers a full cycle of light and dark at a site. Half sunlight is 360 of the 720 hours.'],
  ['Why does a short launch slip matter so much?', 'Near the pole the Sun skims the horizon. A few days’ delay can move a landing into the part of the month when a ridge or crater rim blocks the Sun, and the sunlight total drops sharply.'],
  ['Do my custom sites leave my computer?', 'No. They are calculated in your browser and saved only in its local storage. See the Privacy Policy.'],
  ['Can I use it offline?', 'Yes. The built app is a folder of static files. Run python serve.py inside it and it works without an internet connection.'],
];
