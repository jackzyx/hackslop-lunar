import path from "node:path";
import fs from 'node:fs';
import { pages } from './src/lib/routes.js';
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Keep intro positions separate from the much larger per-site planner tables.
function introScene() {
  const d = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'src/data/ephemeris.json'), 'utf8'));
  const ephemeris = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'src/data/intro-ephemeris.json'), 'utf8'));
  return JSON.stringify({ ephemeris: { ...ephemeris, url: 'intro-positions.bin' }, picks: d.sites.slice(0, 2).map(({name,lat,lon}) => ({name,lat,lon})) });
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
