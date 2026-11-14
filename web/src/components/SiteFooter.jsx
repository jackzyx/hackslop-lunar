import { useState } from 'react';
import { routeUrl } from '@/lib/routes.js';
import { projectRepository } from '@/lib/sources.js';

// 'always' plays the intro on every open; 'seen' (set after the first visit) skips it. Read by index.html.
const INTRO_KEY = 'sun-shade-intro';
const introAlways = () => { try { return localStorage.getItem(INTRO_KEY) === 'always'; } catch { return false; } };

export default function SiteFooter({ page, onRoute, paused, onToggleAnimations }) {
  const [intro, setIntro] = useState(introAlways);
  const toggleIntro = () => { try { localStorage.setItem(INTRO_KEY, intro ? 'seen' : 'always'); } catch { /* storage blocked: keep the default */ } setIntro(!intro); };
  return (
    <footer className="site-footer">
      <p><a className="site-footer-wordmark" href={routeUrl('compare')} onClick={onRoute}>Sun Shade</a><span aria-hidden="true"> · </span>HackAthlone 2026</p>
      <nav aria-label="Footer navigation">
        <a href={routeUrl('about')} onClick={onRoute} aria-current={page === 'about' ? 'page' : undefined}>About</a>
        <a href={`${routeUrl('about')}#about-sources`} onClick={onRoute}>Data &amp; sources</a>
        <a href={projectRepository}>GitHub</a>
        <a href={routeUrl('privacy')} onClick={onRoute} aria-current={page === 'privacy' ? 'page' : undefined}>Privacy Policy</a>
        <a href={routeUrl('terms')} onClick={onRoute} aria-current={page === 'terms' ? 'page' : undefined}>Terms of Service</a>
        <a href={routeUrl('accessibility')} onClick={onRoute} aria-current={page === 'accessibility' ? 'page' : undefined}>Accessibility</a>
        <button type="button" onClick={toggleIntro} aria-pressed={intro}>Intro on open: {intro ? 'On' : 'Off'}</button>
        {onToggleAnimations && <button type="button" onClick={onToggleAnimations}>{paused ? 'Resume animations' : 'Pause animations'}</button>}
        <a href="#site-top">Back to top</a>
      </nav>
    </footer>
  );
}
