# Dépannage

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| `TENANT_BINDING_REQUIRED` | Clé sans `saas_app_id` | Régénérer la clé dans Portal (sélectionner l’app) |
| `TENANT_MISMATCH` | `product_id` d’un autre SaaS | Vérifier `MBEUK_PRODUCT_ID` |
| `PAID_LICENSE_FORBIDDEN` | Appel `licenses.create` avec clé SaaS | Utiliser checkout + webhook |
| `INVALID_API_KEY` | Clé révoquée / mauvaise | Nouvelle clé Portal |
| `LICENSE_EXPIRED` | Essai / abo terminé | Checkout réabonnement |
| `DEVICE_LIMIT_REACHED` | Trop d’appareils | `revokeDevice` puis relogin |
| `ACCOUNT_REQUIRED` | Trial sans compte | `auth.register` d’abord |
| `HUB_ENV_MISSING` | Env absentes | Compléter `.env` / Vercel |
| Checkout 502 | Merchant / Chariow | Config paiements Portal |

Voir aussi l’assistant IA du Developer Portal (`/assistant`).
