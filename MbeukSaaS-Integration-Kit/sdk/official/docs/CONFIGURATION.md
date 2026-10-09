# Configuration

## Variables d’environnement (SERVEUR uniquement)

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `MBEUK_HUB_URL` | oui | URL Hub sans `/api/v1` ni slash final |
| `MBEUK_HUB_API_KEY` | oui | Clé secrète `mbs_…` — **jamais** `NEXT_PUBLIC_*` |
| `MBEUK_PRODUCT_ID` | oui | UUID `products.id` Hub |
| `MBEUK_APPLICATION_ID` | recommandé | UUID `saas_apps.id` (= `hub_saas_app_id` Portal) |
| `MBEUK_ENVIRONMENT` | optionnel | `development` \| `staging` \| `production` |
| `MBEUK_DEVELOPER_REF` | optionnel | Référence développeur (logs) |

## Exemple `.env.example`

```env
MBEUK_HUB_URL=https://votre-hub.example.com
MBEUK_HUB_API_KEY=
MBEUK_PRODUCT_ID=
MBEUK_APPLICATION_ID=
MBEUK_ENVIRONMENT=production
```

## Instantiation

```ts
import { MbeukHub, assertHubEnv } from "mbeuk-hub-sdk";

assertHubEnv(process.env);

export const hub = new MbeukHub({
  baseUrl: process.env.MBEUK_HUB_URL!,
  apiKey: process.env.MBEUK_HUB_API_KEY!,
  productId: process.env.MBEUK_PRODUCT_ID!,
  applicationId: process.env.MBEUK_APPLICATION_ID,
  environment: (process.env.MBEUK_ENVIRONMENT as "production") || "production",
});
```

## Séparation des secrets

| Type | Où | Exemple |
|------|-----|---------|
| Clé API Hub (secrète) | Backend SaaS uniquement | `MBEUK_HUB_API_KEY` |
| Credentials Chariow | Developer Portal / Hub — **pas** dans le SaaS | — |
| Session utilisateur | Cookie httpOnly / stockage serveur | `session_token` Hub |
| Token licence | Stockage local optionnel (UX) — **jamais** comme preuve de paiement | JWT trial |

## Interdits

- `NEXT_PUBLIC_MBEUK_HUB_API_KEY`
- Clé dans HTML, URL, localStorage, logs publics
- Hardcoder `product_id` / `mbs_…` dans le repo
