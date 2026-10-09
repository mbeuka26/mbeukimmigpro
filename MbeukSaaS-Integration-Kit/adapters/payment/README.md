# Payment Adapter

## Flux standard

```text
hub-validate-promo (si code) → hub-checkout → Hub checkout.create → Chariow
  → Pulse webhook Hub (/api/webhooks/chariow) → license
  → SaaS poll hub-sync-license / hub-me → PRO
```

## Règles

- Secrets paiement : **Hub** (`CHARIOW_WEBHOOK_SECRET`) et/ou **Developer Portal** (`whsec_…` chiffré)
- Pulse Chariow : **toujours** URL Hub — jamais le SaaS
- Frontend : redirection vers `checkout_url` seulement
- Post-retour : **poll** `hub-sync-license` / `checkAccess` (snippet `poll-entitlement.snippet.js`)
- Code promo **vide** autorisé si `link_ref` (`?ref=`) déjà capturé

## Affiliation

- `templates/frontend/central-saas/hub-affiliate.js` : `?ref=` + code manuel
- Validation : `hub-validate-promo` → Hub `/api/v1/affiliate/validate`
- Message invalide : « Code promo invalide. Vérifiez le code et réessayez. »
- Marketplace : Installer propage `?ref=` (pas Buy email-only)
