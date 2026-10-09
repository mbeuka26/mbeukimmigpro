# Dépannage

## Auth

| Symptôme | Cause probable | Action |
|---|---|---|
| Login affiché en erreur sans licence | Confusion auth/entitlement | Séparer `sessionOk` et `allowed` (auth-service) |
| `ACCOUNT_NOT_FOUND` | Email inconnu Hub | Message : « Vérifiez votre email et mot de passe. » |
| `WRONG_PASSWORD` | Mot de passe incorrect | Message : « Vérifiez votre mot de passe. » |
| `TENANT_MISMATCH` | Mauvais Product/App ID | Vérifier secrets Supabase |
| `INVALID_API_KEY` | Clé `mbs_` révoquée | Régénérer dans Developer Portal /sdk |
| Compte existe déjà masqué | `recovered_existing` non propagé | central-auth-client signUp |
| « Connexion réseau » sur code promo | `hub-validate-promo` non déployé | Déployer la fonction (script kit 1.4.0) |

## Licence

| Symptôme | Cause | Action |
|---|---|---|
| `LICENSE_NOT_FOUND` après essai | Sync lente | Retry + hub-sync-license |
| `none` affiché comme expiré | `inferStatus` incorrect | subscription-sync.ts |
| Cache stale | hub-me sans refresh Hub | Valider license live à chaque hub-me |

## Paiement / affiliation

| Symptôme | Cause | Action |
|---|---|---|
| Retour success sans accès | Webhook pas encore traité | `pollEntitlementAfterPayment` |
| Checkout fail | Chariow / produit Hub | hub-diagnostics + logs Hub |
| Commission absente | `?ref=` non propagé Installer | Capturer `link_ref` + HubAffiliate |
| Code promo → faux réseau | Edge 404 / CORS | Déployer `hub-validate-promo` |

## Déploiement

| Symptôme | Cause | Action |
|---|---|---|
| Boutons morts après deploy | SW cache | Bump CACHE_NAME, unregister SW |
| Redirect auth loop | Guard bounce | sessionStorage `mbeuk_auth_bounce` |
| PWA non proposable | pas de manifest / SW | `node scripts/install/install-pwa.mjs .` |
| Bannière health rouge | config incomplète | Ouvrir `public/mbeuk-kit-health.html` |

## Diagnostic

```bash
node scripts/diagnose/diagnose.mjs .
node scripts/health-check.mjs .
curl -X POST .../hub-diagnostics -H "x-admin-secret: ..."
```

## Références SDK

`sdk/official/docs/TROUBLESHOOTING.md`
