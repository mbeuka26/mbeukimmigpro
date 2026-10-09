# Architecture — Hub ↔ SaaS

## Vue d'ensemble

```text
                    ┌─────────────────────────┐
                    │   Hub Central (Next.js) │
                    │  Auth · Commerce · API  │
                    └───────────┬─────────────┘
                                │ /api/v1 (mbs_...)
                    ┌───────────▼─────────────┐
                    │   mbeuk-hub-sdk 2.0.0   │
                    └───────────┬─────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
   Edge Functions          Next API            Laravel/Node
   (référence MbeukAgri)   (futur SaaS)        (futur SaaS)
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │   SaaS Frontend (SPA)   │
                    │  Auth UI · Guard · App  │
                    └─────────────────────────┘
```

## Couches du kit

| Couche | Contenu | Réutilisable |
|---|---|---|
| **Contract** | OpenAPI Hub v1, headers, erreurs | 100% |
| **SDK** | `mbeuk-hub-sdk` | 100% |
| **Server bridge** | `_shared/hub-service.ts`, edge `hub-*` | ~95% (adapter noms tables) |
| **Client barrier** | `universal-barrier/MbeukHubGate` | 100% ESM (points de montage à configurer) |
| **PWA** | `templates/frontend/pwa` + `install-pwa.mjs` | 100% si absente ; skip si déjà PWA |
| **Health check** | `scripts/health-check.mjs` + `health-check.js` | 100% |
| **Client snippets** | `central-saas/*` | ~80% (intégration sur mesure) |
| **Migrations SaaS** | profiles.hub_user_id, subscriptions cache | ~90% |
| **Métier** | ERP, RH, immobilier… | 0% dans le kit |

## Flux end-to-end (vérifié MbeukAgri)

```text
Register:  UI → hub-auth-register → Hub auth.register → saas-profile → subscription sync
Login:     UI → hub-auth-login → Hub auth.login → session → entitlement (séparé)
Trial:     UI → validate-trial → Hub licenses.trial → sync → guard app
Checkout:  UI → hub-checkout → Hub checkout → Chariow → webhook → license
Post-pay:  UI → hub-sync-license OU webhook seul → cache active → guard app
App:       MbeukHubGate → hub-me + license-status → contenu métier
```

`MbeukHubGate` masque et rend inerte la racine métier jusqu’à une réponse Hub
valide. Le cache local ne peut jamais transformer seul un statut en accès
Standard.

## Owner types

- **platform** : SaaS édité par NATEIVA (Chariow central).
- **developer** : SaaS tiers via Developer Portal (provider propre).

## Bases de données séparées

- **Hub DB** : licences, orders, products, customer auth.
- **SaaS DB** : métier + cache entitlement (`subscriptions`).

Ne jamais fusionner les autorités.
