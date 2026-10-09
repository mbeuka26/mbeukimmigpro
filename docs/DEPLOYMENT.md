# Déploiement MbeukImmig Pro

> **Guide complet pas à pas :** [`GUIDE_DEPLOIEMENT_A_Z.md`](GUIDE_DEPLOIEMENT_A_Z.md)  
> **CI/CD GitHub :** `.github/workflows/deploy-mbeukimmig.yml` + [`.github/DEPLOY_CONFIG_CHECKLIST.md`](../.github/DEPLOY_CONFIG_CHECKLIST.md)

## Prérequis

- Projet [Supabase](https://supabase.com) (région UE recommandée pour RGPD)
- Hébergement statique (GitHub Pages, Vercel, Netlify) pour `index.html`, `platform.html`, `admin.html`
- Supabase CLI (`supabase link`, `supabase db push`, `supabase functions deploy`)

## 1. Base de données

```bash
supabase login
supabase link --project-ref YOUR_REF
supabase db push
```

Migrations : `supabase/migrations/*.sql`

## 2. Secrets Edge Functions (Dashboard → Edge Functions → Secrets)

| Secret | Usage |
|--------|--------|
| `BYOK_MASTER_KEY_BASE64` | 32 octets aléatoires encodés base64 — **obligatoire pour BYOK** |
| `CENTRAL_OPENAI_API_KEY` | IA centrale OpenAI (optionnel) |
| `CENTRAL_ANTHROPIC_API_KEY` | IA centrale Anthropic (optionnel) |
| `CENTRAL_GOOGLE_API_KEY` | Gemini (optionnel) |
| `CENTRAL_XAI_API_KEY` | Grok (optionnel) |
| `CENTRAL_OPENROUTER_API_KEY` | OpenRouter (optionnel) |
| `CENTRAL_MISTRAL_API_KEY` | Mistral (optionnel) |
| `CRAWLER_CRON_SECRET` | Header `x-cron-secret` pour jobs planifiés |

Activer l’IA centrale :

```sql
update public.central_ai_config set enabled = true, default_provider_id = 'openai', default_model_id = 'gpt-4o-mini' where id = 1;
```

## 3. Déployer les fonctions

```bash
supabase functions deploy byok
supabase functions deploy ai-chat
supabase functions deploy rag-search
supabase functions deploy crawler
supabase functions deploy rag-embed
supabase functions deploy agent
supabase functions deploy admin-health
```

## 4. Frontend

Copier `js/supabase-config.example.js` → `js/supabase-config.js` :

```js
export const SUPABASE_URL = 'https://YOUR_REF.supabase.co';
export const SUPABASE_ANON_KEY = 'your_anon_key';
```

**Ne jamais** y mettre `service_role` ni clés BYOK utilisateur.

## 5. Admin

Attribuer le rôle admin à un utilisateur (service role ou SQL) :

```sql
-- via auth.users raw_app_meta_data
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"admin"}'::jsonb where email = 'admin@example.com';
```

## 6. Collecte planifiée

Configurer un cron (GitHub Actions, Vercel Cron) :

```bash
curl -X POST "$SUPABASE_URL/functions/v1/crawler" \
  -H "Authorization: Bearer $SERVICE_ROLE_JWT" \
  -H "x-cron-secret: $CRAWLER_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":2}'
```

## 7. Validation documentaire

Les documents collectés restent `validation_status = pending` jusqu’à approbation admin (SQL ou future UI).

## 8. Tests locaux

```bash
npm install
npm test
```

## 9. Mode dégradé

Sans clés centrales : guide, recherche FTS, moteur règles, CV local (`index.html`) restent utilisables.

Sans BYOK master : enregistrement clés personnelles **refusé** (503).
