import path from "node:path";
import fs from 'node:fs';
import { sunVector } from './src/terrain/shadow.js';
import { pages } from './src/lib/routes.js';
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The intro needs one landing instant, not the full multi-year ephemeris bundle.
function introScene() {
  const d = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'src/data/ephemeris.json'), 'utf8'));
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

const appPaths = new Set(pages.map(page => `/${page}`));

function pageRoutes(server, directory) {
  const errorPage = path.join(directory, '404.html');
  return () => server.middlewares.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const pathname = req.url.split('?', 1)[0];
    if (appPaths.has(pathname)) {
      req.url = `/index.html${req.url.slice(pathname.length)}`;
      return next();
    }
    if (pathname === '/index.html') return next();
    if (req.headers.accept && !req.headers.accept.includes('text/html') && !req.headers.accept.includes('*/*')) return next();

    try {
      const html = await fs.promises.readFile(errorPage);
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': html.length });
      res.end(req.method === 'HEAD' ? undefined : html);
    } catch (error) {
      next(error);
    }
  });
}

const pageRoutesPlugin = {
  name: 'page-routes',
  configureServer(server) {
    return pageRoutes(server, server.config.publicDir);
  },
  configurePreviewServer(server) {
    return pageRoutes(server, path.resolve(server.config.root, server.config.build.outDir));
  },
};

// Relative base so the built app runs from any folder, a USB stick or a Pages subpath.
export default {
  base: "./",
  appType: 'mpa',
  plugins: [introScenePlugin, pageRoutesPlugin, react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
};
