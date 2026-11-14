export const appBase = new URL('./', location.href);

export function routeUrl(page) {
  return new URL(page, appBase).pathname;
}

export function currentPage() {
  return location.pathname === routeUrl('about') ? 'about' : 'compare';
}

export function migrateLegacyRoute() {
  if (location.pathname !== appBase.pathname && location.pathname !== routeUrl('index.html')) return;
  const { hash, search } = location;
  if (hash === '#about' || hash === '#about-sources' || hash === '#compare') {
    const page = hash === '#compare' ? 'compare' : 'about';
    history.replaceState(history.state, '', routeUrl(page) + search + (hash === '#about-sources' ? hash : ''));
  }
}
