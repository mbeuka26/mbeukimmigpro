// MbeukImmig Pro — PWA offline (app shell)
const CACHE_NAME = 'mbeukimmig-v3.3';

const APP_SHELL = [
  './',
  './index.html',
  './auth.html',
  './choose-access.html',
  './promo.html',
  './platform.html',
  './admin.html',
  './access.html',
  './css/auth-portal.css',
  './css/auth-scene-3d.css',
  './css/app-shell.css',
  './js/platform/auth-ui.js',
  './manifest.json',
  './js/eligibility-rules-v1.js',
  './js/platform/api.js',
  './js/platform/i18n.js',
  './js/platform/providers.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW] cache skip:', url, err.message))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.hostname.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        if (navigator.onLine) {
          caches.open(CACHE_NAME).then((cache) =>
            fetch(request)
              .then((resp) => {
                if (resp && resp.status === 200) cache.put(request, resp.clone());
              })
              .catch(() => {})
          );
        }
        return cached;
      }
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
