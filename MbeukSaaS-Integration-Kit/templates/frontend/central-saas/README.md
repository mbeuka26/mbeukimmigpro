# Frontend bridge (central-saas)

Fichiers de référence pour brancher le frontend SaaS au Hub **sans reconstruire** l’app.

Pour une barrière complète prête à brancher (guard, auth de secours, badges,
device et checkout), utiliser d’abord
`../universal-barrier/mbeuk-hub-gate.js`. Les snippets ci-dessous restent
disponibles pour une intégration sur mesure.

| Fichier | Rôle |
|---|---|
| `hub-affiliate.js` | `?ref=`, code promo manuel, payload `{ promo_code, link_ref }` |
| `poll-entitlement.snippet.js` | Polling après paiement |
| `auth-messages.snippet.js` | Messages login / promo |

## Intégration typique

1. Au boot auth : `HubAffiliate.captureFromUrl()`.
2. Avant checkout : `hub-validate-promo` si code saisi ; sinon continuer avec `link_ref` seul.
3. Après retour paiement : `pollEntitlementAfterPayment` puis ouvrir l’app PRO.

## Source complète

Référence live : `MbeukAgri/src/js/central-saas/` + `auth-main.js` dans le monorepo Hub.
