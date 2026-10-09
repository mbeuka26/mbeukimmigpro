# Guide de déploiement A → Z — MbeukImmig Pro

Ce guide décrit le déploiement complet avec **GitHub** comme point central de configuration (secrets + variables), **Supabase** (base + Edge Functions) et **Vercel** (interface web statique).

> **Note :** si vous parliez de « Langitop / Gitop », dans ce dépôt la source de vérité CI/CD est **GitHub** (Actions). Vercel héberge le frontend ; Supabase héberge l’API serverless.

---

## Vue d’ensemble

```text
Developer Portal Hub          GitHub (Secrets / Variables)
        │                              │
        │                              ├── workflow deploy-mbeukimmig.yml
        ▼                              │
   Hub Central ◄──── Edge hub-* ───────┤──► Supabase (DB + secrets + functions)
                                       │
                                       └──► Vercel (HTML/JS + VITE_* public)
```

**Règle d’or :** les clés **Hub** (`mbs_…`), **service_role**, **BYOK**, **IA centrale** → **Supabase secrets uniquement**.  
Sur Vercel : **uniquement** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.

---

## Étape 1 — Prérequis

| Outil | Rôle |
|--------|------|
| Compte [Supabase](https://supabase.com) | Projet Postgres + Auth + Edge Functions |
| Compte [Vercel](https://vercel.com) | Hébergement `platform.html`, `index.html`, PWA |
| Dépôt GitHub `mbeukimmigpro` | Code + CI/CD |
| Developer Portal Mbeuk Hub | `MBEUK_PRODUCT_ID`, `MBEUK_APPLICATION_ID`, clé `mbs_…` |

En local (optionnel) : Node 20+, `npm ci`, Supabase CLI, Vercel CLI.

---

## Étape 2 — Créer le projet Supabase

1. **New project** → choisir région **UE** si contrainte RGPD.
2. Noter :
   - **Project URL** → `https://XXXX.supabase.co`
   - **Project ref** (Settings → General) → `SUPABASE_PROJECT_REF`
   - **anon key** (Settings → API)
   - **service_role key** (Settings → API) — **serveur / CI uniquement**

3. Appliquer les migrations (première fois, en local ou via CI) :

```bash
supabase login
supabase link --project-ref VOTRE_REF
supabase db push
```

4. Activer **Auth** (email/password) dans Authentication → Providers.

5. (Optionnel) Promouvoir un admin :

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'votre@email.com';
```

---

## Étape 3 — Projet Vercel

1. **Import** du dépôt GitHub `mbeukimmigpro`.
2. Framework : **Other** (site statique).
3. **Build command** : `bash scripts/ci/generate-supabase-config.sh` (déjà dans `vercel.json`).
4. **Output directory** : `.` (racine).
5. Noter **ORG ID** et **PROJECT ID** (Settings → General).

6. Lier le domaine personnalisé si besoin.

---

## Étape 4 — Configurer GitHub (cœur du workflow)

Dans le dépôt GitHub : **Settings → Secrets and variables → Actions**.

### 4.1 Variables (onglet *Variables* — non secrètes)

| Nom | Exemple | Destination CI |
|-----|---------|------------------|
| `SUPABASE_PROJECT_REF` | `abcdefghijklmnop` | Supabase CLI |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Vercel + build |
| `MBEUK_HUB_URL` | `https://mbeukhub.vercel.app` | Secrets Supabase |
| `MBEUK_PRODUCT_ID` | UUID Hub | Secrets Supabase |
| `MBEUK_APPLICATION_ID` | UUID Hub | Secrets Supabase |
| `MBEUK_ENVIRONMENT` | `production` | Secrets Supabase |
| `VERCEL_ORG_ID` | `team_…` ou `user_…` | Vercel CLI |
| `VERCEL_PROJECT_ID` | `prj_…` | Vercel CLI |
| `SUPABASE_DB_PUSH_ON_MAIN` | `false` | Si `true`, `db push` auto sur `main` |

### 4.2 Secrets (onglet *Secrets*)

| Nom | Destination |
|-----|-------------|
| `SUPABASE_ACCESS_TOKEN` | [Supabase Account → Access Tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → secrets Edge |
| `VITE_SUPABASE_ANON_KEY` | Vercel env (public) |
| `VERCEL_TOKEN` | [Vercel → Account → Tokens](https://vercel.com/account/tokens) |
| `MBEUK_HUB_API_KEY` | Supabase secrets (`mbs_…`) |
| `MBEUK_AUTH_BRIDGE_SECRET` | Supabase secrets (32+ caractères aléatoires) |
| `BYOK_MASTER_KEY_BASE64` | Supabase secrets (32 octets en base64) |
| `CENTRAL_OPENAI_API_KEY` | Supabase (optionnel) |
| `CENTRAL_ANTHROPIC_API_KEY` | Supabase (optionnel) |
| `CENTRAL_GOOGLE_API_KEY` | Supabase (optionnel) |
| `CENTRAL_XAI_API_KEY` | Supabase (optionnel) |
| `CENTRAL_OPENROUTER_API_KEY` | Supabase (optionnel) |
| `CENTRAL_MISTRAL_API_KEY` | Supabase (optionnel) |
| `CRAWLER_CRON_SECRET` | Supabase + header cron |
| `ADMIN_SECRET` | Supabase (`hub-diagnostics`) |

**Ne jamais** ajouter `MBEUK_HUB_API_KEY` ou `service_role` dans Vercel.

---

## Étape 5 — Environnement GitHub « production »

Le workflow utilise `environment: production` pour les jobs Supabase et Vercel.

1. GitHub → **Settings → Environments → New environment** → `production`.
2. Y recopier les mêmes secrets/variables (ou utiliser les secrets au niveau repo — les deux fonctionnent).
3. (Recommandé) Activer **Required reviewers** pour les déploiements manuels sensibles.

---

## Étape 6 — Lancer le workflow

Fichier : `.github/workflows/deploy-mbeukimmig.yml`

### Déclenchement automatique

Push sur **`main`** (fichiers applicatifs / supabase / workflow) :

1. Tests (`npm test` + validation kit Hub)
2. Sync **secrets → Supabase**
3. Déploiement **Edge Functions**
4. Sync **variables → Vercel**
5. **Deploy Vercel** (`--prod` sur `main`)

### Déclenchement manuel

**Actions → Deploy MbeukImmig → Run workflow**

Cases à cocher :

- Synchroniser secrets Supabase
- Déployer Edge Functions
- Appliquer migrations (`db push`) — **à activer seulement** quand vous avez validé les SQL
- Sync variables Vercel
- Deploy Vercel

---

## Étape 7 — Vérifications post-déploiement

### Supabase

```bash
supabase functions list --project-ref VOTRE_REF
```

Tester (avec JWT utilisateur) :

- `POST /functions/v1/hub-diagnostics`
- `POST /functions/v1/hub-auth-login`
- `POST /functions/v1/rag-search`

Dashboard → Edge Functions → Logs.

### Vercel

1. Ouvrir l’URL de production.
2. `platform.html` → connexion Hub + barrière licence.
3. Vérifier que `js/supabase-config.js` est bien généré au build (pas de clé Hub dans le bundle).

### Health check kit (local)

```bash
node MbeukSaaS-Integration-Kit/scripts/health-check.mjs .
```

Message attendu : *OK - Le kit et la PWA installable ont été bien connectés et vérifiés sans faille*

---

## Étape 8 — Hub Central (manuel)

1. Developer Portal → application **MbeukImmig Pro** → noter UUID produit / application.
2. Coller dans GitHub Variables / Secrets (voir étape 4).
3. Pulse **Chariow** → URL **Hub** uniquement :  
   `https://mbeukhub.vercel.app/api/webhooks/chariow`
4. Relancer le workflow (secrets Supabase).

---

## Étape 9 — Activer l’IA centrale (optionnel)

Après déploiement, en SQL (Supabase SQL Editor) :

```sql
update public.central_ai_config
set enabled = true,
    default_provider_id = 'openai',
    default_model_id = 'gpt-4o-mini'
where id = 1;
```

Sans clés `CENTRAL_*` dans Supabase secrets, seuls **BYOK** et fonctions non-IA restent disponibles.

---

## Étape 10 — Exploitation & cron collecte

Planifier un cron (GitHub Actions scheduled ou Vercel Cron) :

```bash
curl -X POST "$SUPABASE_URL/functions/v1/crawler" \
  -H "Authorization: Bearer $SERVICE_ROLE_JWT" \
  -H "x-cron-secret: $CRAWLER_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":2}'
```

Valider les documents collectés (`validation_status = approved`) avant RAG public.

---

## Dépannage

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| Workflow échoue « SUPABASE_PROJECT_REF » | Variable GitHub absente | Remplir Variables |
| Edge Function 401 | JWT / anon key | Vérifier `Authorization` + `apikey` |
| Hub login échoue | Secrets Hub manquants | Relancer sync secrets |
| Vercel sans Supabase | Build sans `VITE_*` | Secrets Vercel + regénérer config |
| `db push` casse prod | Migration destructive | Désactiver `SUPABASE_DB_PUSH_ON_MAIN`, tester en staging |

---

## Scripts CI (référence)

| Script | Rôle |
|--------|------|
| `scripts/ci/deploy-supabase-secrets.sh` | GitHub → Supabase secrets |
| `scripts/ci/deploy-supabase-functions.sh` | Déploie toutes les fonctions `supabase/functions/*/index.ts` |
| `scripts/ci/sync-vercel-env.sh` | GitHub → Vercel env |
| `scripts/ci/generate-supabase-config.sh` | Build → `js/supabase-config.js` |

---

## Checklist finale

- [ ] Variables + secrets GitHub remplis
- [ ] Premier `workflow_dispatch` avec migrations si base vierge
- [ ] Edge Functions listées dans Supabase
- [ ] Site Vercel accessible (`platform.html`)
- [ ] Login Hub + essai / achat testés
- [ ] Aucune clé `mbs_` dans le repo ou le bundle Vercel

Pour l’architecture IA/RAG détaillée, voir aussi [`docs/DEPLOYMENT.md`](DEPLOYMENT.md) et [`SAAS-HUB-INTEGRATION-REPORT.md`](../SAAS-HUB-INTEGRATION-REPORT.md).
