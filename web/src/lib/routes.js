export const pages = ['compare', 'about', 'privacy', 'terms', 'accessibility'];
let appBase;

function baseUrl() {
  return appBase ??= new URL('./', location.href);
}

export function routeUrl(page) {
  return new URL(page, baseUrl()).pathname;
}

export function pageForPath(pathname) {
  return pages.find(page => pathname === routeUrl(page));
}

export function currentPage() {
  return pageForPath(location.pathname) ?? 'compare';
}

export function isPolicyPage(page) {
  return page === 'privacy' || page === 'terms' || page === 'accessibility';
}

export function migrateLegacyRoute() {
  if (location.pathname !== baseUrl().pathname && location.pathname !== routeUrl('index.html')) return;
  const { hash, search } = location;
  if (hash === '#about' || hash === '#about-sources' || hash === '#compare') {
    const page = hash === '#compare' ? 'compare' : 'about';
    history.replaceState(history.state, '', routeUrl(page) + search + (hash === '#about-sources' ? hash : ''));
  }
}
