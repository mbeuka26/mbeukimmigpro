# Paiement

## Principe

```text
Frontend → product_id + email (+ code affilié)
     ↓
Backend SaaS → hub.checkout.create (SDK + clé secrète)
     ↓
Hub → prix catalogue + merchant Chariow (serveur)
     ↓
Redirect checkout_url
     ↓
Webhook Hub (signature) → licence + commissions
```

Le SaaS **ne contient pas** les secrets Chariow.  
Configurer Chariow dans le **Developer Portal** (paiements).

## SDK

```ts
const session = await hub.checkout.create({
  customer_email: email,
  promo_code: manualCode, // priorité sur link_ref
  link_ref: savedRef,
});
// session.checkout_url → redirect
// session.sale_id → vente pending Hub (corrélation uniquement, jamais preuve de paiement)
```

## Interdits

- Activer une licence sur `/success` seul
- Activer une licence depuis une vente `pending`, quel que soit son âge
- Faire confiance au montant envoyé par le navigateur
- Exposer `MBEUK_HUB_API_KEY` au client

## Après paiement

Informer l’utilisateur → `validateLicense` / `login` / `sync` pour rafraîchir l’accès.
