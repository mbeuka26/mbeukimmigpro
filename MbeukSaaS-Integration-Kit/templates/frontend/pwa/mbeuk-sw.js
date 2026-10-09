const CACHE = "mbeuk-gate-pwa-v1";
const NEVER_CACHE = /hub-auth|hub-checkout|hub-sync|hub-me|hub-license|validate-trial|hub-validate|functions\/v1|mbs_/i;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = request.url;
  if (NEVER_CACHE.test(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request)),
    );
    return;
  }

  const dest = request.destination;
  if (!["style", "script", "image", "font", "manifest"].includes(dest)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    }),
  );
});
