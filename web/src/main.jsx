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
overlay.querySelector('.skip').addEventListener('click', loadApp);
if (location.hash.startsWith('#about') || matchMedia('(prefers-reduced-motion: reduce)').matches || overlay.dataset.bootSkipped === 'true') {
  loadApp();
  overlay.hidden = true;
} else {
  fetch(new URL('intro-scene.json', document.baseURI)).then(response => {
    if (!response.ok) throw new Error('Intro scene unavailable');
    return response.json();
  }).then(scene => {
    if (scene.appModule) {
      const preload = document.createElement('link'); preload.rel = 'prefetch'; preload.as = 'script';
      preload.href = new URL(scene.appModule, document.baseURI).href; document.head.append(preload);
    }
    if (!location.hash.startsWith('#about') && overlay.dataset.bootSkipped !== 'true') {
      let reveal;
      const readyToReveal = new Promise(resolve => { reveal = resolve; });
      playIntro({ ...scene, terrainReady, readyToReveal, onLanding: () => loadApp().then(reveal) });
    } else loadApp();
  }).catch(() => { loadApp(); overlay.hidden = true; });
}
