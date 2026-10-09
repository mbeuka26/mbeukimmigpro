# Entitlement Adapter

Cache local synchronisé depuis Hub — **pas une autorité**.

## Tables SaaS (template)

- `subscriptions` : status, hub_license_id, hub_last_sync_at
- Statuts : `none`, `pending`, `trial`, `active`, `expired`, `blocked`

## Fonctions

- `hub-me` — refresh live
- `hub-license-status` — guard application
- `subscription-sync.ts` — `inferStatus()` : `none` ≠ `expired`

## Frontend guard

Pattern `AuthService.checkAccess()` + overlay guard (voir référence MbeukAgri `main.js`).
