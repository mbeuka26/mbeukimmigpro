/** Chemins du parcours Hub (auth → accès → métier). */
export const ROUTES = {
  auth: './auth.html',
  chooseAccess: './choose-access.html',
  promo: './promo.html',
  app: './platform.html',
  cvLegacy: './cv-pro-legacy.html',
};

export function currentPageName() {
  const path = globalThis.location?.pathname || '';
  const base = path.split('/').pop();
  return base || 'index.html';
}

export function isAuthEntryPage() {
  const p = currentPageName();
  return p === 'auth.html' || p === 'index.html' || p === 'access.html';
}

export function isAccessFlowPage() {
  const p = currentPageName();
  return p === 'choose-access.html' || p === 'promo.html';
}

export function isAppPage() {
  return currentPageName() === 'platform.html';
}
