import { createRoot } from "react-dom/client";
import "./styles/index.css";
import { playIntro } from './intro/intro.js';
import { initialTerrain } from './terrain/startup.js';
import { loadPlannerData } from './lib/data.js';

// No StrictMode: it runs effects twice in dev, which would start two intro animations at once.
const terrainReady = initialTerrain().catch(() => null);
const overlay = document.getElementById('intro');
let appReady;
const loadApp = () => appReady ??= Promise.all([import('./App.jsx'), loadPlannerData()]).then(([{ default: App }]) => {
  createRoot(document.getElementById('root')).render(<App />);
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}).catch(error => {
  overlay.hidden = true;
  document.querySelector('.planner-loading').textContent = 'Could not load the planner. Refresh to try again.';
  console.error(error);
});
overlay.querySelector('.skip').addEventListener('click', () => {
  if (overlay.dataset.bootSkipped === 'true') loadApp();
});
if (location.hash.startsWith('#about') || matchMedia('(prefers-reduced-motion: reduce)').matches || overlay.dataset.bootSkipped === 'true') {
  loadApp();
  overlay.hidden = true;
} else {
  fetch(new URL('intro-scene.json', document.baseURI)).then(response => {
    if (!response.ok) throw new Error('Intro scene unavailable');
    return response.json();
  }).then(scene => {
    if (!location.hash.startsWith('#about') && overlay.dataset.bootSkipped !== 'true') {
      if (scene.appModule) {
        const preload = document.createElement('link');
        preload.rel = 'modulepreload';
        preload.fetchPriority = 'low';
        preload.href = new URL(scene.appModule, document.baseURI).href;
        document.head.append(preload);
      }
      playIntro({ ...scene, terrainReady, onLanding: loadApp });
      loadPlannerData().catch(() => {});
    } else loadApp();
  }).catch(() => { loadApp(); overlay.hidden = true; });
}
