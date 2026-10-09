# Influenceurs & affiliation

## Méthode 1 — Code saisi

L’utilisateur entre un code → passer en `promo_code` au checkout.

## Méthode 2 — Lien `?ref=`

```ts
import { extractRefFromUrl, resolveAffiliateAttribution } from "mbeuk-hub-sdk";

const fromUrl = extractRefFromUrl(requestUrl);
// Stocker en cookie / session (côté SaaS ou marketplace)
const slug = resolveAffiliateAttribution({
  manualCode: formCode,
  linkRef: fromUrl || cookieRef,
});
// → checkout.create({ promo_code: slug }) si manuel, sinon link_ref
```

**Priorité :** code manuel > lien affilié.

## Construction d’URL (admin / storefront)

```ts
hub.influencers.buildAffiliateUrl("https://mbeukstore.com", "ABC123");
// → https://mbeukstore.com?ref=ABC123
```

## Commissions

Calculées **uniquement** sur le Hub après webhook (plateforme + influenceur + développeur).  
Le SaaS n’envoie jamais de montants de commission.
