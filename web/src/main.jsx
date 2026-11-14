import { createRoot } from "react-dom/client";
import "./index.css";
import { playIntro } from './intro.js';
import { initialTerrain } from './startup.js';

// No StrictMode: it runs effects twice in dev, which would start two intro animations at once.
const terrainReady = initialTerrain().catch(() => null);
let appReady;
const loadApp = () => appReady ??= import('./App.jsx').then(({ default: App }) => {
  createRoot(document.getElementById('root')).render(<App />);
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});
const overlay = document.getElementById('intro');
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
    } else loadApp();
  }).catch(() => { loadApp(); overlay.hidden = true; });
}
