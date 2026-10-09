# Sécurité — Intégration Hub SaaS

## Secrets — classification

| Variable | Zone | Exposition |
|---|---|---|
| `MBEUK_HUB_API_KEY` | Edge / backend | **Jamais** frontend |
| `MBEUK_AUTH_BRIDGE_SECRET` | Edge | **Jamais** frontend |
| `MBEUK_SERVICE_ROLE_KEY` | Edge | **Jamais** frontend |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Public (RLS requis) |
| Chariow secrets | Hub / Dev Portal | **Jamais** SaaS platform |

## RLS SaaS

- `profiles` : utilisateur voit son profil (`auth.uid()`).
- `subscriptions` : cache entitlement par `user_id`.
- Pont Hub : `hub-session-auth.ts` valide JWT bridge.

## Webhooks

- Traités **uniquement** côté Hub (`/api/webhooks/chariow`).
- Le SaaS ne doit pas accepter un webhook Chariow direct sans validation Hub.

## Paiement

- Redirection checkout ≠ preuve de paiement.
- Sync via `hub-sync-license` ou refresh `hub-me` après délai webhook.

## Scan automatique

```bash
node scripts/diagnose/diagnose.mjs . 
# Détecte mbs_*, sk-ant-*, VITE_MBEUK_HUB_API_KEY
```

## Codes sécurité kit

| Code | Description |
|---|---|
| SEC-001 | Secret pattern dans source/dist |
| SEC-002 | Clé Hub en variable publique |
| RLS-001 | Policy manquante sur table sensible |

## Référence

`packages/mbeuk-hub-sdk/docs/SECURITY.md`
