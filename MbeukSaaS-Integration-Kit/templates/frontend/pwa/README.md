# PWA installable (kit)

Le kit n’écrase jamais un Service Worker ou un manifest déjà présents
(`vite-plugin-pwa`, Serwist, `sw.js`, etc.).

Si aucun n’existe, `scripts/install/install-pwa.mjs` ajoute :

- `public/manifest.webmanifest`
- `public/mbeuk-sw.js` (network-first HTML, jamais de cache auth/Hub)
- `public/icons/mbeuk-icon-192.png` et `512.png`
- `apple-touch-icon.png`

L’enregistrement du SW se fait dans `bootMbeukHubGate()` via `pwa.js`.
