# PROMPT 2 — Audit & plan de migration Hub (MbeukImmig Pro)

**Date :** 2026-10-11  
**Kit validé :** MbeukSaaS-Integration-Kit **v1.8.01** · SDK **mbeuk-hub-sdk@2.0.0**  
**Statut global :** migration **largement réalisée** ; écarts kit ↔ prod, tests E2E Hub et durcissement PWA/RLM restants.

---

## 1. Rapport d’audit (Étape 1)

### 1.1 Stack & structure

| Domaine | Constat |
|---------|---------|
| **Frontend** | HTML statique + modules ES (`js/platform/*`, `src/mbeuk-gate/*`), pas de bundler React/Vite pour l’app métier |
| **Hébergement** | Vercel (`vercel.json` : build = génération `js/supabase-config.js`, rewrite `/` → `auth.html`) |
| **Backend** | Supabase (Postgres + RLS, Auth bridge, Edge Functions Deno) |
| **Identité / commerce** | Hub Central via SDK vendored + Edge `hub-*` |
| **Tests** | Vitest (4 fichiers métier) + validateur kit (`validate.mjs`, 13 checks) |
| **CI** | `.github/workflows/deploy-mbeukimmig.yml` (test → secrets/functions/db → Vercel) |

**Points d’entrée utilisateur :**

- `auth.html` — connexion / inscription / mot de passe perdu  
- `choose-access.html` — essai 1j vs achat licence  
- `promo.html` — code ambassadeur (optionnel) → checkout  
- `platform.html` — métier (ImmiPro, CV, agent IA)  
- `index.html`, `access.html` — redirection vers `auth.html`  
- `cv-pro-legacy.html` — CV historique (lien depuis routes)  
- `admin.html` — admin (hors parcours client)

### 1.2 UI auth / récupération de compte

- **Conservée et branchée Hub** : onglets Se connecter / Créer un compte, champs kit (`full_name`, `phone`, `email`, `password`), mot de passe perdu via formulaire dédié (`hub-auth-forgot-password`).  
- **Plus d’auth inline sur `platform.html`** (forms `#login-form` / `#register-form` absents).  
- **Barrière overlay** (`mbeuk-gate`) toujours disponible pour `authMode: universal` ; produit utilise **`authMode: existing` + `pageRouting: true`**.

### 1.3 Ancienne vs nouvelle logique (auth / licence / paiement)

| Ancien (supprimé / absent du code actif) | Nouveau (kit validé) |
|------------------------------------------|----------------------|
| Firebase (mention contenu métier uniquement) | Hub `auth.register` / `auth.login` via Edge |
| Licence locale comme vérité | Hub + cache `subscriptions` / `hub-license-status` |
| — | Essai : `validate-trial` (serveur, session Hub) |
| — | Paiement : `hub-checkout` → Chariow → webhook Hub ; `accessGrantedFromPaymentReturn()` = **false** |
| — | Pont Supabase JWT (`MBEUK_AUTH_BRIDGE_SECRET`) pour RLS métier |

**Fichiers kit dans le dépôt :** `MbeukSaaS-Integration-Kit/` (référence), copie active dans `src/mbeuk-gate/` et `supabase/functions/` (divergences locales documentées §1.7).

### 1.4 Données, RLS, API serveur

**Migrations appliquées (repo) :**

1. `20261009000000_initial_schema.sql` — `profiles`, `immigration_projects`, `eligibility_runs`, `guide_sections`, RLS par `auth.uid()`  
2. `20261009010000_ai_rag_platform.sql` — RAG, conversations, jobs crawler  
3. `20261009020000_byok_text_storage.sql` — BYOK chiffré  
4. `20261009030000_mbeuk_hub_integration.sql` — `subscriptions`, `licenses` (cache), `license_history`, `hub_affiliate_sessions`, colonnes `profiles.hub_*`

**Kit templates SQL non copiés tels quels :** `001/002/003` du kit → contenu **fusionné / équivalent** dans `20261009030000` (index `hub_user_id`, contraintes `license_history`). **Manque possible :** commentaires SQL explicites « licenses = LEGACY » du template `002` (sémantique déjà respectée dans le code Edge).

**Edge Functions Hub (12, conformes au contrat kit) :**  
`hub-ping`, `hub-auth-login`, `hub-auth-register`, `hub-auth-logout`, `hub-auth-refresh`, `hub-auth-forgot-password`, `hub-me`, `hub-checkout`, `hub-validate-promo`, `validate-trial`, `hub-sync-license`, `hub-license-status`, `hub-diagnostics`.

**Edge Functions métier / IA (optionnelles, indépendantes du Hub) :**  
`ai-chat`, `rag-search`, `rag-embed`, `agent`, `byok`, `crawler`, `admin-health`.

**RLS :** tables métier et hub-cache protégées par utilisateur authentifié (bridge Supabase). **Aucune clé service role côté client** (`.env.example` + `generate-supabase-config.sh` n’exposent que anon).

### 1.5 PWA, logo, offline

- `manifest.json` : `start_url` = `./auth.html`, icônes `icons/icon-192.png`, `icons/icon-512.png` (+ doublons `public/icons/mbeuk-icon-*`).  
- `service-worker.js` : cache shell v3.3 ; **bypass réseau pour `*.supabase.co`** (entitlements non figés offline).  
- `sw.js` présent — vérifier qu’une seule registration SW est active (actuellement `platform.html` enregistre `service-worker.js`).

### 1.6 Fonctions métier à préserver

- Guide immigration embarqué (`content/immigration-guide-full.html` → `platform.html`)  
- Module CV (section + `cv-pro-legacy.html`)  
- Assistant IA / RAG / éligibilité / BYOK (dépendent Supabase + secrets centraux ou BYOK)  
- Projets immigration (`immigration_projects`) — **données restent dans Supabase SaaS**, pas dans le Hub

### 1.7 Capacités Cloud central & IA

| Capacité | État dans ce SaaS |
|----------|-------------------|
| **Hub Central (identité/commerce)** | **Requis** pour auth, essai, licence, checkout |
| **Cloud central générique** | Non modélisé comme produit séparé ; pas d’endpoint « Cloud Mbeuk » obligatoire hors Hub |
| **IA centrale** | **Supportée, facultative** : `CENTRAL_*_API_KEY` ; sans clé → 503 / messages UI (`genDisabled`) |
| **BYOK** | **Supportée, facultative** : `byok` Edge + `BYOK_MASTER_KEY_BASE64` |
| **Panne IA/Cloud** | Guide/CV HTML restent utilisables ; chat/RAG/agent échouent proprement |

### 1.8 Dépendances offline

- Shell auth + pages statiques en cache ; **pas d’accès métier protégé sans session Hub/Supabase live**.  
- Risque résiduel : cache agressif des **JS** gate — bump `CACHE_NAME` / query `?v=` à chaque release auth.

### 1.9 Tests & validation

| Commande | Résultat (2026-10-11, agent local) |
|----------|--------------------------------------|
| `npm test` | **10/10 OK** (eligibility, RAG chunk, BYOK crypto, LLM registry) |
| `node MbeukSaaS-Integration-Kit/scripts/validate/validate.mjs .` | **13/13 OK** |
| Tests kit contract (`universal-gate`, etc.) | Inclus dans validate.mjs |
| Login/register live Hub | **NON EXÉCUTÉ** (secrets prod requis) |
| Parcours paiement / webhook | **NON EXÉCUTÉ** |
| Essai expiré / licence révoquée live | **NON EXÉCUTÉ** |
| Mobile E2E production | **NON EXÉCUTÉ** (erreur « Failed to fetch » signalée utilisateur sur inscription) |

### 1.10 Écarts kit ↔ application (drift)

- `src/mbeuk-gate/*` **diffère** du template `templates/frontend/universal-barrier/` (routing pages, CORS client, retry register).  
- `platform-boot.js` : `skipLiveHub: true` vs `auth-boot.js` : `skipLiveHub: false` — comportement health-check incohérent entre pages.  
- Kit template `integrationKitVersion` **1.8.0** vs `hub.integration.json` **1.8.01** (mineur).  
- Rapport `SAAS-HUB-INTEGRATION-REPORT.md` (2026-10-09) **partiellement obsolète** (index.html overlay).

### 1.11 Comptes / mots de passe non migrables

- **Autorité mot de passe = Hub Central.** Comptes créés uniquement dans Supabase Auth local (pré-Hub) **ne sont pas migrables** sans export Hub.  
- **Stratégie recommandée (non destructive) :** conserver lignes `profiles` / projets ; lier au Hub via **inscription Hub avec même email** + `hub_user_id` sur `profiles` ; anciens mots de passe locaux → **« Mot de passe perdu »** Hub.  
- **Ne pas** copier données métier vers la base Hub.

---

## 2. Plan de migration (Étapes 2–6)

> La migration structurelle est faite ; le plan ci-dessous vise **conformité kit**, **stabilité prod**, et **couverture de tests**.

### Phase A — Stabilisation auth prod (priorité P0)

1. Vérifier secrets : `APP_URL=https://immig.mbeuk.co` (sans `/` final), `MBEUK_*`, bridge secret ≥ 32 car.  
2. Confirmer deploy Edge : `hub-auth-register` avec **`--no-verify-jwt`** + CORS `corsHeadersFor(req)`.  
3. Tester inscription → redirect `choose-access.html` (curl OPTIONS/POST + navigateur).  
4. Aligner `skipLiveHub` / health sur auth et platform.

**Risque :** faux négatif réseau mobile si CORS ou JWT gateway mal configurés.  
**Rollback :** redeploy fonction + secret `APP_URL` précédent ; pas de migration SQL.

### Phase B — Parcours entitlement (P0)

1. Matrice kit : register → choose-access ; trial → platform ; buy → promo → checkout ; login + BLOCKED → `?reason=unpaid|expired`.  
2. Vérifier polling `hub-sync-license` après retour checkout (sans accorder sur `?payment=success` seul).  
3. Documenter durée essai (1j) et licence (~3 ans) **côté produit Hub Central** (pas frontend).

**Risque :** décalage durée essai Hub vs message UI « 1 jour ».  
**Rollback :** revert JS gate uniquement.

### Phase C — Sync kit validé (P1)

1. Diff périodique `src/mbeuk-gate` ↔ template kit ; porter correctifs kit upstream, conserver custom `pageRouting`.  
2. Option : script CI `diff-kit-barrier.sh` (warn only).  
3. Appliquer migration SQL kit `002` **commentaires only** si absent (idempotent).

**Risque :** écraser custom routing.  
**Rollback :** git revert.

### Phase D — RLS & API métier (P1)

1. Audit appels `callFunction` depuis `platform-boot.js` : exiger session bridge valide.  
2. Edge `ai-chat` / `rag-*` : vérifier entitlement côté serveur (aujourd’hui auth Supabase ; renforcer si lecture publique).  
3. Tests d’accès direct Edge sans JWT → 401.

**Risque :** régression IA si check entitlement trop strict sans trial actif.  
**Rollback :** policy Edge feature-flag.

### Phase E — PWA & UX (P2)

1. Unifier SW (`service-worker.js` seul).  
2. Bump cache à chaque release auth.  
3. Vérifier manifest shortcuts (platform protégée → OK si redirect gate).  
4. Conserver logo `icons/*` (ne pas remplacer sans validation produit).

### Phase F — Tests obligatoires PROMPT 2 (P0–P1)

Exécuter checklist avec secrets staging/prod **sur autorisation** :

- [ ] Email invalide / déjà utilisé  
- [ ] Login valide / invalide  
- [ ] Erreur réseau simulée (DevTools offline)  
- [ ] Nouvel utilisateur sans licence → choose-access  
- [ ] Essai actif / expiré  
- [ ] Paiement confirmé webhook vs abandonné / en attente  
- [ ] Licence active / expirée / révoquée (Hub admin)  
- [ ] Accès direct `platform.html` sans droit  
- [ ] App sans clés IA centrales (guide/CV OK)  
- [ ] PWA install + refresh post-expiration  

Ajouter **tests automatisés** : importer tests contract kit dans `npm test` (gate-messages, payment return).

---

## 3. Stratégie rollback migrations SQL

| Migration | Rollback |
|-----------|----------|
| `20261009030000` | **Non destructif recommandé** : tables hub-cache restent ; désactiver sync Edge si besoin |
| Hub columns on `profiles` | Laisser en place (nullable) |
| Données utilisateur métier | **Jamais supprimer** pour rollback kit |

En cas d’urgence commerce : désactiver checkout côté Hub + message maintenance ; auth Hub reste.

---

## 4. Actions manuelles opérateur

1. Developer Portal Hub : produit, essai, webhook Chariow → Hub uniquement.  
2. GitHub secrets : `SUPABASE_*`, `MBEUK_*`, `APP_URL`, `VITE_SUPABASE_*`.  
3. `workflow_dispatch` avec **Appliquer migrations SQL** si drift.  
4. Communication utilisateurs pré-Hub : email + lien mot de passe oublié Hub.

---

## 5. Risques restants

1. **Inscription prod « Failed to fetch »** — CORS / JWT / config Vercel (P0 ouvert).  
2. **Drift kit** — correctifs sécurité kit non mergés automatiquement.  
3. **Durée licence/essai** — configurée Hub, pas versionnée dans ce repo.  
4. **Tests E2E Hub absents** en CI sans sandbox credentials.  
5. **Double icônes / SW** — confusion PWA mineure.

---

## 6. Fichiers clés (référence migration)

- Contrat : `hub.integration.json`  
- Barrière : `src/mbeuk-gate/mbeuk-hub-gate.js`, `hub-gate-client.js`, `boot.js`  
- Pages : `auth.html`, `choose-access.html`, `promo.html`, `platform.html`  
- Edge Hub : `supabase/functions/hub-*`, `_shared/hub-service.ts`, `cors.ts`  
- CI : `scripts/ci/deploy-supabase-functions.sh`, `generate-supabase-config.sh`  
- Doc flux : `docs/MBEUK-INTEGRATION-FLOW-REPORT.md`

---

*Aucune modification de données ni déploiement production effectué dans le cadre de cet audit (PROMPT 2 Étape 1).*
