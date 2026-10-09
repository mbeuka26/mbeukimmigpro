# mbeuk-hub-sdk

SDK officiel **JavaScript / TypeScript** pour le Hub central MbeukTechnologies.

**Version : 2.0.0**

Vos SaaS l’utilisent côté **serveur** pour : auth clients, vérification de licences, essai, checkout Chariow (via Hub), catalogue, cloud.

> Le Hub Central est la source d’autorité. Le frontend n’est jamais une preuve de paiement.

## Documentation

| Fichier | Contenu |
|---------|---------|
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | Install / pack |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Variables d’env |
| [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) | Comptes clients |
| [docs/LICENSE.md](docs/LICENSE.md) | Licences & trial |
| [docs/PAYMENT.md](docs/PAYMENT.md) | Checkout |
| [docs/INFLUENCER.md](docs/INFLUENCER.md) | Codes & liens |
| [docs/WEBHOOKS.md](docs/WEBHOOKS.md) | Paiement confirmé |
| [docs/SECURITY.md](docs/SECURITY.md) | Secrets & tenant |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Erreurs fréquentes |
| [CHANGELOG.md](CHANGELOG.md) | Versions |

## Installation

```bash
npm install ./mbeuk-hub-sdk-2.0.0.tgz
```

Téléchargez le `.tgz` + le **prompt d’intégration** depuis le Developer Portal → page SDK.

## Démarrage rapide (serveur SaaS)

```ts
import {
  MbeukHub,
  MbeukHubError,
  assertHubEnv,
  SDK_VERSION,
} from "mbeuk-hub-sdk";

assertHubEnv(process.env);

const hub = new MbeukHub({
  baseUrl: process.env.MBEUK_HUB_URL!,
  apiKey: process.env.MBEUK_HUB_API_KEY!, // SECRET — jamais NEXT_PUBLIC_
  productId: process.env.MBEUK_PRODUCT_ID!,
  applicationId: process.env.MBEUK_APPLICATION_ID,
  environment: "production",
});

console.log(hub.version); // "2.0.0"

// Accès
const access = await hub.licenses.validateLicense({
  email: "client@exemple.com",
  device_identifier: "optional-fingerprint",
});

// Auth
await hub.auth.register({
  email: "client@exemple.com",
  password: "Secret123!",
  product_id: process.env.MBEUK_PRODUCT_ID!,
  start_trial: true,
  device_identifier: "…",
});

// Checkout (prix résolu sur le Hub)
const session = await hub.checkout.create({
  customer_email: "client@exemple.com",
  promo_code: "AMB4F2A",
});
// redirect → session.checkout_url
```

## API exposée

| Ressource | Méthodes |
|-----------|----------|
| `hub.health()` | statut |
| `hub.products` | `list`, `get`, `create`, `update`, `remove` |
| `hub.licenses` | `list`, `verify`, `validateLicense`, `activate`, `startTrial`, `sync` (`create` = admin) |
| `hub.influencers` | `list`, `get`, `create`, `update`, `remove`, `buildAffiliateUrl` |
| `hub.checkout` | `create` |
| `hub.auth` | `register`, `login`, `refreshSession`, `forgotPassword`, `logout`, `revokeDevice` |
| `hub.saasApps` / `hub.cloud` / `hub.apiKeys` | selon scopes |

## Auth Hub

- **SaaS** : `apiKey: "mbs_…"` → `X-API-Key` (liée à `saas_app_id`)
- **Admin** : `bearerToken` JWT

## Erreurs

```ts
try {
  await hub.licenses.validateLicense({ email });
} catch (e) {
  if (e instanceof MbeukHubError) {
    console.error(e.code, e.status, e.message);
  }
}
```

## Prérequis Hub / Portal

1. Application synchronisée (`hub_saas_app_id`)
2. Clé API créée **avec sélection de l’application**
3. Produit publié (`MBEUK_PRODUCT_ID`)
4. Paiements Chariow configurés dans le Portal si merchant mode

Prompt IA : `PROMPT_CONNECT_SAAS_TO_HUB.md` (Developer Portal / `docs/`).
