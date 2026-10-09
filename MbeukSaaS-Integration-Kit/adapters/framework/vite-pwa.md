# Framework Adapter — Vite PWA (référence)

## Détecté dans MbeukAgri

- `vite.config.js` — entrées `auth.html` + `app.html`
- `app-routes.js` — `/auth` et `/app` (prod), `.html` en dev
- `vercel.json` — rewrite `/` → `/auth`, redirect `/index` → `/app`
- Module ES `auth-main.js` — expose handlers `window.*` tôt

## Checklist adaptation autre Vite SaaS

1. Copier `templates/frontend/universal-barrier/` dans `src/mbeuk-gate/`
2. Initialiser `MbeukHubGate` avant le bootstrap de la page app
3. Pointer `protectedRoot` vers le contenu métier uniquement
4. Utiliser `bindExistingAuth()` si la page auth existe
5. `type="module"` pour la barrière et le bridge central-saas
6. Service worker : ne pas cacher auth / `hub-*` en stale indéfiniment
7. Si aucune PWA : `node scripts/install/install-pwa.mjs .` (skip automatique si déjà présent)

Le kit n’écrase **jamais** `vite-plugin-pwa`, Serwist ou un `sw.js` existant.

## Next.js

- API routes pour hub-* ou Supabase Edge externe
- Pas de `MBEUK_HUB_API_KEY` en `NEXT_PUBLIC_*`
