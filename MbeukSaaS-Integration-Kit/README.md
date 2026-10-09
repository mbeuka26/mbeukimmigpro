# MbeukSaaS Integration Kit

**Version :** 1.8.0 · **SDK embarqué :** mbeuk-hub-sdk 2.0.0 · **Contrat Hub :** `/api/v1`

Kit officiel pour intégrer un SaaS (**propriétaire plateforme** ou **développeur externe**) au **Hub Central**  
et le piloter depuis le **Developer Portal** (clé API, apps, Chariow Pulse, marketplace).

Un seul ZIP d’intégration — configurez `ownerType` (`platform` | `developer`) dans `hub.integration.json`.

## Commencer ici

→ **[docs/HOW_TO_USE.md](docs/HOW_TO_USE.md)** — guide pas à pas (connexion + portal + affiliation).

## Principe

```
Hub Central (auth, licences, paiements, commissions)
        │
   mbeuk-hub-sdk + Edge hub-* (ce kit)
        │
   Votre SaaS (métier indépendant)
        │
Developer Portal (clé API, apps, téléchargement kit)
```

**Référence de validation :** MbeukAgri — **pas une dépendance runtime du kit**.

## Contenu du kit

| Dossier | Rôle |
|---|---|
| `sdk/official/` | SDK `mbeuk-hub-sdk@2.0.0` (dist + `.tgz`) |
| `integration/` | Templates `hub.integration`, `env.example`, compatibilité |
| `templates/supabase/` | Migrations + `_shared` + **fonctions hub-*** + deploy script |
| `templates/frontend/central-saas/` | Affiliate, poll entitlement, messages UX |
| `templates/frontend/universal-barrier/` | `MbeukHubGate`, `boot.js`, auth de secours, PWA, health check |
| `templates/frontend/pwa/` | Manifest + Service Worker (si le SaaS n’est pas déjà PWA) |
| `adapters/` | Guides auth, entitlement, payment, framework |
| `scripts/` | `diagnose`, `validate`, `dry-run`, `install-sdk`, `install-pwa`, `health-check` |
| `docs/` | HOW_TO_USE, architecture, contrat, déploiement… |
| `prompts/integrate-saas.md` | Prompt autonome Cursor/Claude |

## Démarrage rapide

```bash
node scripts/dry-run.mjs /chemin/vers/mon-saas
node scripts/install/apply-kit.mjs /chemin/vers/mon-saas
# apply-kit copie la barrière, configure la PWA si absente, lance le health check
node /chemin/vers/kit/scripts/install/install-sdk.mjs /chemin/vers/mon-saas
cp integration/hub.integration.template.json /chemin/vers/mon-saas/hub.integration.json
cp integration/env.example /chemin/vers/mon-saas/.env.example
# Copier templates/supabase/edge-functions/* puis :
# bash templates/supabase/deploy-edge-functions.sh
node scripts/validate/validate.mjs /chemin/vers/mon-saas
node scripts/health-check.mjs /chemin/vers/mon-saas
```

## Séparation Auth ≠ Licence

- **Login** OK même sans licence (`ACCOUNT_NOT_FOUND` / `WRONG_PASSWORD` distincts).
- **Entitlement** séparé (`hub-me`, `hub-license-status`, poll post-paiement).
- **Paiement** confirmé par **webhook Hub**, jamais par la seule redirection frontend.

## Marketplace

Parcours officiel : **Installer** (avec `?ref=`) → compte SaaS → acheter.  
Voir `docs/HOW_TO_USE.md` §4–6.

## Documentation

- [Comment utiliser le kit](docs/HOW_TO_USE.md)
- [Guide d'intégration](docs/integration-guide.md)
- [Architecture](docs/architecture.md)
- [Contrat d'intégration](docs/integration-contract.md)
- [Déploiement](docs/deployment-guide.md)
- [Sécurité](docs/security.md)
- [Dépannage](docs/troubleshooting.md)
- [Changelog](CHANGELOG.md)

## Versions

| Composant | Version |
|---|---|
| Integration Kit | 1.8.0 |
| SDK | 2.0.0 |
| Hub API contract | v1 |

Voir [CHANGELOG.md](CHANGELOG.md) et [docs/compatibility.md](docs/compatibility.md).

## Licence

SDK : UNLICENSED — usage interne NATEIVA/MBEUK. Ne pas redistribuer les secrets.
