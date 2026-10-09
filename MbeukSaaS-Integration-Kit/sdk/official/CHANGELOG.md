# Changelog — mbeuk-hub-sdk

## 2.0.0 — 2026-08-07

### Ajouts
- `SDK_VERSION` / `MbeukHub.version` = `2.0.0`
- Config : `productId`, `applicationId`, `developerRef`, `environment`
- `hub.licenses.validateLicense()` (alias de `verify`)
- `assertHubEnv()` pour valider les variables serveur
- `resolveAffiliateAttribution` / `extractRefFromUrl` (priorité code manuel > lien)
- Headers `X-Mbeuk-SDK-Version`, `X-Mbeuk-Application-Id`, `X-Mbeuk-Product-Id`
- `HubErrorCodes` (référence)
- Checkout typé (`CheckoutSession` avec `checkout_url`, `sale_id`)
- Documentation `docs/*.md` + prompt d’intégration aligné isolation multi-tenant

### Changements de comportement (Hub déjà en place)
- Clé API SaaS **doit** être liée à un `saas_app_id` (sinon `TENANT_BINDING_REQUIRED`)
- `licenses.create` **refusé** pour les clés SaaS (`PAID_LICENSE_FORBIDDEN`) — paiement via webhook uniquement
- `product_id` optionnel sur `verify` / `checkout` si `config.productId` est défini

### Compatibilité
- Appels `verify`, `auth.*`, `checkout.create`, `startTrial` inchangés si vous passez toujours `product_id` explicitement
- Régénérez la clé API depuis le Developer Portal (liée à l’application Hub)

## 1.1.1

- Auth clients, licences, checkout, cloud, influenceurs (baseline Portal)
