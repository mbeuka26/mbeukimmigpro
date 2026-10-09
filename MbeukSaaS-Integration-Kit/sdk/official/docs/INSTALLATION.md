# Installation

## Depuis le Developer Portal (recommandé)

1. Connectez-vous au **Developer Portal**
2. Ouvrez **SDK**
3. Téléchargez `mbeuk-hub-sdk-2.0.0.tgz`
4. Dans votre projet SaaS :

```bash
npm install ./mbeuk-hub-sdk-2.0.0.tgz
# ou
npm install ./chemin/vers/mbeuk-hub-sdk-2.0.0.tgz
```

5. Téléchargez aussi le **prompt d’intégration** et donnez-le à Cursor / Claude avec votre code.

## Depuis le monorepo Hub

```bash
cd packages/mbeuk-hub-sdk
npm install
npm run build
npm pack   # → mbeuk-hub-sdk-2.0.0.tgz
```

## Prérequis

- Node.js ≥ 18
- Compte Developer Portal **actif**
- Application SaaS **synchronisée** sur Hub Central (`hub_saas_app_id`)
- Clé API `mbs_…` **liée à cette application**
- UUID produit Hub (`MBEUK_PRODUCT_ID`)

## Vérification rapide

```ts
import { MbeukHub, SDK_VERSION } from "mbeuk-hub-sdk";
console.log(SDK_VERSION); // "2.0.0"
```
