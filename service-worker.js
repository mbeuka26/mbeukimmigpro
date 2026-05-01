// ============================================================
// service-worker.js — PWA Offline-First
// Guide d'Immigration Pro 2.1
// ============================================================

const CACHE_NAME    = 'immigration-guide-v2.1';
const CACHE_STATIC  = 'immigration-static-v1';

// Fichiers à mettre en cache immédiatement (App Shell)
const APP_SHELL = [
  './',
  './index.html',
  './access.html',
  './app.js',
  './firebase.js',
  './manifest.json',
  // Google Fonts (on tente de les mettre en cache si réseau dispo)
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@300;400;500&display=swap',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,400&display=swap',
  // Font Awesome
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
];

// ────────────────────────────────────────────────────────────
// INSTALL : mise en cache de l'App Shell
// ────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing…');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // On tente chaque fichier individuellement pour ne pas bloquer si un échoue
      const promises = APP_SHELL.map(url =>
        cache.add(url).catch(err => {
          console.warn('[SW] Impossible de cacher:', url, err.message);
        })
      );
      await Promise.all(promises);
      console.log('[SW] App Shell mis en cache');
    }).then(() => self.skipWaiting())
  );
});

// ────────────────────────────────────────────────────────────
// ACTIVATE : nettoyage des anciens caches
// ────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CACHE_STATIC)
          .map(k => {
            console.log('[SW] Suppression ancien cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ────────────────────────────────────────────────────────────
// FETCH : stratégie Cache First pour assets, Network First pour API
// ────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ── Ignorer les requêtes Firebase (toujours réseau) ──
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com')
  ) {
    return; // Laisse le navigateur gérer normalement
  }

  // ── Stratégie : Cache First (avec fallback réseau) ──
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Rafraîchir en background (stale-while-revalidate)
        if (navigator.onLine) {
          caches.open(CACHE_NAME).then(cache =>
            fetch(request).then(resp => {
              if (resp && resp.status === 200) cache.put(request, resp.clone());
            }).catch(() => {})
          );
        }
        return cached;
      }

      // Pas en cache → réseau
      return fetch(request).then(response => {
        // Ne cacher que les réponses valides
        if (
          response &&
          response.status === 200 &&
          response.type !== 'opaque' || response.type === 'basic'
        ) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, response.clone());
          });
        }
        return response;
      }).catch(() => {
        // Offline + pas en cache → page fallback
        if (request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ────────────────────────────────────────────────────────────
// MESSAGE : forcer la mise à jour du cache
// ────────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
