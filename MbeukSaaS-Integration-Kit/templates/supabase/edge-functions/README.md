# Edge Functions — Templates (kit 1.4.0)

Templates **prêts à copier** depuis la référence MbeukAgri (génériques Hub).

## Contenu

### `_shared/`
Client Hub, session, sync licence, profil SaaS, CORS, rate-limit, etc.

### Fonctions incluses
| Fonction | Rôle |
|---|---|
| `hub-auth-*` | Register / login / logout / forgot / refresh |
| `hub-me` | Profil + entitlement |
| `hub-checkout` | Session paiement Chariow via Hub |
| `hub-validate-promo` | Validation code influenceur (**obligatoire si affiliate**) |
| `hub-sync-license` / `hub-license-status` | Sync entitlement |
| `hub-diagnostics` | Diagnostic config |
| `validate-trial` | Essai gratuit |

Script : `../deploy-edge-functions.sh` (liste à jour avec `hub-validate-promo`).

## Déploiement

```bash
cp -r templates/supabase/edge-functions/_shared supabase/functions/_shared
cp -r templates/supabase/edge-functions/hub-* supabase/functions/
cp -r templates/supabase/edge-functions/validate-trial supabase/functions/
cp templates/supabase/deploy-edge-functions.sh scripts/
bash scripts/deploy-edge-functions.sh
```

## Personnalisation SaaS
- Adapter tables `profiles` / `subscriptions` si besoin
- Ne pas casser `hub-service.ts` sans revue contrat Hub
