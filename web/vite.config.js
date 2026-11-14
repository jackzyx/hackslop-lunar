import path from "node:path";
import fs from 'node:fs';
import { sunVector } from './src/terrain/shadow.js';
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The intro needs one landing instant, not the full multi-year ephemeris bundle.
function introScene() {
  const d = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'src/mock-data.json'), 'utf8'));
  const ms = Date.parse('2026-11-20T00:00:00Z'), i = Math.round((ms - Date.parse(d.ephemeris.start_utc)) / 3600000);
  const site = d.sites[0], eph = d.ephemeris.sites[site.id];
  return JSON.stringify({ ms, sun: sunVector(site.lat, site.lon, eph.sun_az[i], eph.sun_el[i]), picks: d.sites.slice(0, 2).map(({name,lat,lon}) => ({name,lat,lon})), when: new Date(ms).toLocaleDateString('en-IE', {timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}) });
}
const introScenePlugin = {
  name: 'intro-scene',
  configureServer(server) {
    server.middlewares.use('/intro-scene.json', (_req, res) => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ ...JSON.parse(introScene()), appModule: 'src/App.jsx' })); });
  },
  generateBundle(_options, bundle) {
    const app = Object.values(bundle).find(item => item.type === 'chunk' && item.facadeModuleId?.replaceAll('\\','/').endsWith('/src/App.jsx'));
    this.emitFile({ type:'asset', fileName:'intro-scene.json', source:JSON.stringify({ ...JSON.parse(introScene()), appModule: app?.fileName }) });
  },
};

// Relative base so the built app runs from any folder, a USB stick or a Pages subpath.
export default {
  base: "./",
  plugins: [introScenePlugin, react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
};
