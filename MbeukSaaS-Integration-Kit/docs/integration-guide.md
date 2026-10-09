# Guide d'intégration — NATIVA SaaS Integration Kit

## Prérequis Hub Central (Super Admin)

1. Créer l'**Application SaaS** dans l'admin Hub.
2. Créer le **Product** lié (`owner_type = platform` pour SaaS NATEIVA).
3. Générer clé API `mbs_...` avec scopes : `auth`, `licenses:read`, `licenses:write`, `checkout`.
4. Appliquer migrations Hub si nécessaire (`licenses.access_type`, customer auth).
5. Configurer Chariow + webhook `/api/webhooks/chariow`.

## Étapes SaaS

### Phase A — Audit (obligatoire)

```bash
node scripts/dry-run.mjs .
node scripts/diagnose/diagnose.mjs .
```

### Phase B — Manifest

```bash
cp integration/hub.integration.template.json ./hub.integration.json
# Éditer : name, slug, capabilities, ownerType
```

### Phase C — SDK

```bash
node scripts/install/install-sdk.mjs .
```

### Phase D — Backend (Supabase Edge recommandé)

1. Copier `templates/supabase/edge-functions/_shared/` → `supabase/edge-functions/_shared/`
2. Copier les fonctions `hub-*` depuis la référence MbeukAgri ou les templates du monorepo
3. Appliquer migrations `templates/supabase/migrations/` (adapter noms si conflit)
4. Configurer secrets Supabase (voir `integration/env.example`)

### Phase E — Frontend bridge

Pattern **central-saas** (référence MbeukAgri) :

| Module | Rôle |
|---|---|
| `central-auth-client.js` | Appels Edge Functions auth |
| `auth-service.js` | Login ≠ entitlement, checkout, trial |
| `hub-affiliate.js` | Attribution `?ref=` / code promo |
| `app-routes.js` | Routes auth ↔ app |

Adapter les chemins selon framework (Vite, Next.js…).

### Phase F — UX auth

- Login sans licence → message entitlement, pas erreur auth.
- Panneau « Synchroniser mon accès » post-paiement.
- Essai gratuit → session requise avant `validate-trial`.
- Checkout → étape ambassadeur optionnelle si `affiliate: true`.

### Phase G — Guard application

Vérifier entitlement avant d'afficher l'ERP (pattern `saasAccessGuard` dans `main.js` MbeukAgri).

### Phase H — Validation

```bash
node scripts/validate/validate.mjs .
npm test   # si disponible
```

### Phase I — Diagnostic live

```bash
curl -X POST "$SUPABASE_URL/functions/v1/hub-diagnostics" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "x-admin-secret: $ADMIN_SECRET"
```

## Checklist flux manuels

1. Inscription → profil SaaS + compte Hub
2. Login sans licence → session OK, entitlement `none`
3. Essai → `validate-trial` → accès app
4. Checkout → Chariow → webhook → sync
5. Sync manuelle post-paiement
6. Logout / refresh session

## Anti-patterns interdits

- `MBEUK_HUB_API_KEY` en `VITE_*`
- Validation paiement par URL `success=true` seule
- Licence payante émise localement sans Hub
- Confondre `none` et `expired` pour l'UX

## Références

- `docs/integration-contract.md`
- `docs/SAAS_INTEGRATION_CHECKLIST.md` (Hub monorepo)
- `prompts/integrate-saas.md`
