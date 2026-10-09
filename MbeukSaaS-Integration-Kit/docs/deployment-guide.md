# Déploiement

## Hub Central

1. Migrations SQL Hub (manuel, Supabase Hub SQL Editor).
2. Variables Vercel Hub : Chariow, Supabase, secrets webhook.
3. Vérifier `/api/v1/health`.

## SaaS (référence Vercel + Supabase)

### Supabase

```bash
# Secrets Edge Functions
supabase secrets set MBEUK_HUB_URL=...
supabase secrets set MBEUK_HUB_API_KEY=...
supabase secrets set MBEUK_PRODUCT_ID=...
supabase secrets set MBEUK_APPLICATION_ID=...
supabase secrets set MBEUK_AUTH_BRIDGE_SECRET=...
supabase secrets set MBEUK_SERVICE_ROLE_KEY=...

# Migrations
supabase db push

# Edge Functions (adapter liste depuis hub.integration.json)
bash scripts/deploy-edge-functions.sh
```

### Vercel (frontend)

- `buildCommand`: `npm run build`
- `outputDirectory`: `dist`
- Rewrites auth/app (voir référence MbeukAgri `vercel.json`)
- **Ne pas** exposer secrets Hub en env public Vercel.

### Post-déploiement

1. `hub-diagnostics` → tous PASS/WARN documentés
2. Smoke : register → login → trial → app
3. Invalider service worker si PWA (`sw.js` cache bump)

## CI/CD

Template : `ci-cd/github/saas-hub-integration.yml`

Pipeline : install → lint → test → build → scan secrets dist/

## Rollback

- Git revert sur SaaS uniquement pour intégration.
- Hub Central : ne pas rollback migrations sans plan DBA.
