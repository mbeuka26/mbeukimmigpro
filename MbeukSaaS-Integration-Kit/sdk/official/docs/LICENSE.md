# Licences & essai

## Vérification (serveur)

```ts
const result = await hub.licenses.validateLicense({
  email: user.email,
  // product_id optionnel si config.productId est défini
  device_identifier: fingerprint,
});

if (!result.valid) {
  // LICENSE_EXPIRED | LICENSE_NOT_FOUND | DEVICE_LIMIT_REACHED | …
}
```

Alias : `hub.licenses.verify` ≡ `validateLicense`.

## Trial

```ts
await hub.auth.register({
  email,
  password,
  product_id,
  start_trial: true,
  device_identifier,
});
// ou hub.licenses.startTrial({ … }) si compte déjà créé
```

- Durée : `products.trial_days` (souvent 3) — défini sur le Hub
- 1 essai / email / produit ; 1 appareil en trial
- Décision **serveur Hub** uniquement

## Paid

Créée uniquement après **webhook Chariow signé** sur le Hub.

`hub.licenses.create` est **admin-only** ; une clé SaaS reçoit `PAID_LICENSE_FORBIDDEN`.

## Sync après paiement

```ts
await hub.licenses.sync({ email, product_id, … });
// ou re-login / validateLicense — ne crée PAS une licence paid
```

## Isolation multi-tenant

La clé API doit avoir `saas_app_id` = votre application.  
Sinon : `TENANT_BINDING_REQUIRED` / `TENANT_MISMATCH` si `product_id` d’un autre SaaS.
