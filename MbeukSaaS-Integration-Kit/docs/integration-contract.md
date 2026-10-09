# Contrat d'intégration Hub Central ↔ SaaS

**Version contrat :** v1 · **SDK :** mbeuk-hub-sdk 2.0.0 · **Kit :** 1.8.0

Document dérivé du code réel (Hub Central + référence MbeukAgri). Les noms de variables ci-dessous sont ceux utilisés en production.

---

## 1. Identités

| Concept | Source autorité | Variable config | Notes |
|---|---|---|---|
| Application (SaaS app) | Hub `saas_apps` | `MBEUK_APPLICATION_ID` | Identité technique |
| Product (licensable) | Hub `products` | `MBEUK_PRODUCT_ID` | Commerce, trial, licence |
| Utilisateur | Hub auth customers | `hub_user_id` (cache SaaS) | Lié via pont RLS |

**Règle :** `MBEUK_APPLICATION_ID` ≠ `MBEUK_PRODUCT_ID`. Relation configurée dans Hub admin.

---

## 2. Authentification

### Principe
- Hub Central est l'**autorité d'identité** (`identityAuthority: mbeuk_hub`).
- Le SaaS conserve un profil local (`profiles`) lié par `hub_user_id`.
- **Login réussi ≠ licence active.**

### Flux client typique (Supabase Edge)

```text
POST /functions/v1/hub-auth-login
  → Hub POST /api/v1/auth/login (X-API-Key: mbs_...)
  → sync subscription cache local
  → retour session + entitlement séparé
```

### Headers Hub API (serveur)

```http
X-API-Key: mbs_...
X-Mbeuk-Application-Id: <uuid>   # recommandé
X-Mbeuk-Product-Id: <uuid>       # requis pour auth/licenses
Content-Type: application/json
```

### Edge Functions auth (template)

| Function | Rôle |
|---|---|
| `hub-auth-register` | Inscription Hub + profil SaaS |
| `hub-auth-login` | Connexion + sync entitlement |
| `hub-auth-logout` | Déconnexion Hub |
| `hub-auth-refresh` | Refresh session |
| `hub-auth-forgot-password` | Reset via Hub |

---

## 3. Entitlement / Licence

### Cache SaaS (`subscriptions`)

Statuts supportés : `trial`, `active`, `expired`, `blocked`, `none`, `pending`.

| Statut | Signification UX |
|---|---|
| `none` | Compte OK, pas de licence |
| `pending` | Paiement en cours de confirmation |
| `trial` | Essai actif |
| `active` | Licence payée active |

### Fonctions

| Function | Rôle |
|---|---|
| `hub-me` | Profil + refresh live depuis Hub |
| `hub-license-status` | Statut licence pour guard app |
| `hub-sync-license` | Sync post-paiement manuel |
| `validate-trial` | Démarrage essai (session requise) |

### SDK (serveur)

```ts
import { MbeukHub } from 'mbeuk-hub-sdk';

const hub = new MbeukHub({
  baseUrl: process.env.MBEUK_HUB_URL!,
  apiKey: process.env.MBEUK_HUB_API_KEY!,
  productId: process.env.MBEUK_PRODUCT_ID!,
  applicationId: process.env.MBEUK_APPLICATION_ID,
});

await hub.licenses.verify({ email, product_id });
await hub.licenses.startTrial({ email, product_id, device_identifier });
```

---

## 4. Paiement

### Flux

```text
hub-checkout (session utilisateur)
  → Hub POST /api/v1/checkout ou /api/checkout
  → Payment Provider (Chariow)
  → Webhook Hub /api/webhooks/chariow
  → Order + License côté Hub
  → SaaS sync via hub-sync-license / hub-me
```

### Règles

- Le frontend reçoit `checkout_url` et redirige — **ce n'est pas une preuve de paiement**.
- Retour `?payment=success` déclenche une **sync serveur**, pas une activation locale.
- Une vente `pending` signifie uniquement « checkout ouvert ». Même ancienne, elle
  ne doit jamais être promue en `completed` ni produire une licence.
- Seul le webhook Chariow signé portant un événement de succès peut confirmer la
  vente. Une réparation automatique exige la vente `completed` et la trace
  `webhook_events` correspondante.
- Aucun secret Chariow dans le SaaS (owner platform) ou via Developer Portal (owner developer).

### Affiliation (optionnel)

- Priorité : `promo_code` manuel > `link_ref` URL (`?ref=`).
- Validation : Hub `POST /api/v1/affiliate/validate` (proxy SaaS : `hub-validate-promo`).

---

## 5. Owner routing

| owner_type | Paiement | Configuration |
|---|---|---|
| `platform` | Chariow Hub (Super Admin) | SaaS plateforme NATEIVA |
| `developer` | Provider développeur | Developer Portal |

Le kit ne modifie pas ce routage Hub-Core.

---

## 6. Erreurs

### Hub / SDK (`MbeukHubError.code`)

Voir `sdk/official/docs/TROUBLESHOOTING.md` et `HubErrorCodes` dans le SDK.

### Kit diagnostics (`scripts/diagnose`)

| Code | Signification |
|---|---|
| SDK-001 | SDK absent ou secret exposé |
| AUTH-001 | Couche auth non détectée |
| APP-001 | manifest / App ID manquant |
| PRODUCT-001 | Product ID manquant |
| ENV-001 | Framework / env non détecté |
| PAYMENT-001 | Checkout non configuré |
| WEBHOOK-001 | Webhook non vérifiable |
| LICENSE-001 | Sync licence échouée |
| DB-001 | Migrations manquantes |
| SEC-001 | Secret dans frontend |
| DEPLOY-001 | Edge Functions manquantes |
| CI-001 | Pipeline incomplet |

---

## 7. Base de données — frontières

| Base | Contient | Ne contient pas |
|---|---|---|
| **Hub Central Supabase** | users auth, products, licenses, orders, webhooks | Données métier SaaS |
| **SaaS Supabase** | profiles, données métier, cache subscriptions | Émission licence payante autonome |

Migrations Hub applicables manuellement sur Hub (ex. `access_type` sur `licenses`).

---

## 8. Sécurité

### Serveur uniquement
- `MBEUK_HUB_API_KEY`
- `MBEUK_AUTH_BRIDGE_SECRET`
- `MBEUK_SERVICE_ROLE_KEY`

### Frontend autorisé
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Interdit frontend
- Clé `mbs_...`
- Secrets webhook / Chariow

---

## 9. Versioning

| Artefact | Version actuelle |
|---|---|
| Integration Kit | 1.8.0 |
| mbeuk-hub-sdk | 2.0.0 |
| hub.integration schema | 1.0 |
| Hub API | v1 |

---

## 10. Références code Hub Central

- `packages/mbeuk-hub-sdk/`
- `docs/API_CENTRAL.md`
- `docs/HUB_AUTH_CUSTOMERS.md`
- `app/api/v1/*`
- `app/api/webhooks/chariow/route.ts`
- `docs/openapi.yaml`

## 11. Référence implémentation

MbeukAgri : `MbeukAgri/hub.integration.json` (dans le monorepo Hub, **hors kit ZIP** — copie de référence `integration/hub.integration.reference.json`).
