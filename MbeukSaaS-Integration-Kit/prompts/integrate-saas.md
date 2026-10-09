# Intégrer un SaaS au Hub Central Mbeuk

**Kit :** MbeukSaaS-Integration-Kit v1.8.0 · **SDK :** mbeuk-hub-sdk@2.0.0

**Usage autonome** — fonctionne avec :

```text
SaaS.zip + MbeukSaaS-Integration-Kit-v1.8.0.zip (+ optionnel : SDK .tgz)
```

Téléchargement officiel (propriétaires plateforme **et** développeurs externes) :

- Developer Portal → **/sdk** → **Télécharger le kit d’intégration (.ZIP)**
- Même ZIP pour `ownerType: platform` et `ownerType: developer` (renseigner dans `hub.integration.json`)

Lire d’abord `docs/HOW_TO_USE.md` du kit et le guide HTML
`GUIDE_CONNEXION_SAAS_HUB_A_Z.html` (Developer Portal → /sdk).

## Mission

Tu es un **Senior Integration Engineer**. Intègre le SaaS fourni au **Hub Central Mbeuk**
en utilisant le **MbeukSaaS Integration Kit** et le SDK officiel (`mbeuk-hub-sdk@2.0.0`).

**Règle absolue : FIX, DON'T REBUILD.** Préserve le métier, l'UI et l'architecture existante.

Le kit agit comme une **barrière externe**. Ne supprime ni ne réécris le métier,
les composants internes ou le schéma existant. Les seules modifications
autorisées sont les points de branchement minimaux (bootstrap racine, handlers
auth existants, point de montage header et configuration).

## Règle AUTH EXISTANTE (critique)

**Si le projet a déjà une page / écran d’authentification** (login, register, mot de passe oublié) :

1. **NE PAS** créer une nouvelle page auth, un nouveau design system login, ni remplacer les routes UI.
2. **Conserver** formulaires, styles, textes, navigation existants.
3. **Brancher uniquement** la logique :
   - appels Edge `hub-auth-login` / `hub-auth-register` / forgot-password, **ou**
   - SDK serveur `hub.auth.*` derrière les handlers déjà en place.
4. Séparer clairement :
   - **session OK** (identité Hub) ≠ **licence / entitlement PRO**.
5. Messages UX (ne pas afficher un faux « erreur réseau ») :
   - email mal formé → « Email invalide. Saisissez correctement votre email puis reconnectez-vous. »
   - `ACCOUNT_NOT_FOUND` → « Vérifiez votre email et mot de passe. »
   - `WRONG_PASSWORD` → « Vérifiez votre mot de passe. »
   - code promo invalide → « Code promo invalide. Vérifiez le code et réessayez. »
6. Retirer uniquement les actions obsolètes du type « Renouveler la licence »
   lorsqu’elles contournent le checkout Hub ; conserver les composants et
   proposer à la place l’achat Standard via `hub-checkout`.

Si aucune page auth n’existe, alors seulement créer le minimum nécessaire (une surface auth simple), sans over-engineering.

## Workflow obligatoire

```text
AUDIT → DETECT → CLASSIFY → PLAN → DRY RUN → APPLY → TEST → VALIDATE → SECURITY AUDIT → FINAL REPORT
```

Ne modifie **aucun fichier** avant la phase PLAN (sauf si l'utilisateur demande explicitement d'appliquer).

## Phase 1 — AUDIT

1. Détecter framework, langage, package manager, auth, DB, déploiement, CI/CD.
2. **Repérer toute page auth existante** (chemins, composants, services).
3. Lire `hub.integration.json` s'il existe.
4. Exécuter (ou simuler) :
   - `node scripts/dry-run.mjs <saas-root>`
   - `node scripts/diagnose/diagnose.mjs <saas-root>`
5. Comparer SDK kit vs SDK externe si fourni — **ne pas écraser** sans validation.

## Phase 2 — CLASSIFY

Classer chaque élément :

- **GENERIC** → utiliser templates/adapters du kit
- **APPLICATION-SPECIFIC** → ne pas toucher / ne pas mettre dans Hub
- **HUB-CORE** → ne modifier Hub que si nécessité générique démontrée
- **EXISTING_AUTH_UI** → conserver ; bridge Hub seulement

## Phase 3 — PLAN

Produire un plan listant :
- fichiers à créer/modifier ;
- **comment** l’auth existante sera branchée (sans rebuild UI) ;
- migrations SaaS uniquement ;
- secrets à configurer (sans valeurs) ;
- risques et conflits.

Attendre validation utilisateur si ambigu.

## Phase 4 — DRY RUN

Afficher le plan sans modifier le code métier.

## Phase 5 — APPLY (minimum safe change)

1. `hub.integration.json` depuis `integration/hub.integration.template.json`
2. SDK : `node scripts/install/install-sdk.mjs <saas-root>`
3. Copier/adapt `templates/supabase/` (migrations + `_shared` + hub-* **dont hub-validate-promo**)
4. **Recommandé :** `node scripts/install/apply-kit.mjs <saas-root>` (copie uniquement les fichiers manquants, n’écrase jamais une page auth)
5. Copier `templates/frontend/universal-barrier/` (ou `install-barrier.mjs`) et appeler `bootMbeukHubGate()` avant le bootstrap du contenu protégé.
6. Brancher auth **dans** les écrans existants avec `bindExistingAuth()` (login, register, forgot, promo, essai, achat, logout).
   Utiliser `authMode: "universal"` seulement si le SaaS n'a aucune auth.
7. Ajouter au header un point de montage `#hub-user-status` pour le nom + badge
   **Essai gratuit (N jours)** ou **Standard**.
8. `.env.example` depuis `integration/env.example`
9. **PWA :** `node scripts/install/install-pwa.mjs <saas-root>` — uniquement si aucune PWA n’existe (ne jamais écraser vite-plugin-pwa / Serwist / sw.js).
10. **Health check :** `node scripts/health-check.mjs <saas-root>` — succès exact :
    *OK - Le kit et la PWA installable ont été bien connectés et vérifiés sans faille*
    Sinon afficher la liste (manifest, SW, icônes, clés, Gate, Hub injoignable) dans la console et `public/mbeuk-kit-health.html`.
11. **Ne pas** hardcoder App ID / Product ID réels dans le code source

## Barrière universelle obligatoire

`MbeukHubGate` doit :

1. masquer/rendre inerte la racine métier pendant `checking`, `anonymous`,
   `blocked` et `error` ;
2. ouvrir uniquement sur entitlement Hub `trial` ou `standard` valide ;
3. restaurer l'accès après reconnexion via `hub-me` +
   `hub-license-status`, même si le stockage navigateur a été effacé ;
4. afficher le nom du profil Hub et le badge d'état dans le header ;
5. appliquer l'essai par email/appareil via `validate-trial` (le serveur reste
   l'autorité ; l'empreinte navigateur seule ne décide jamais) ;
6. conserver `?ref=` et donner priorité au code promo manuel validé ;
7. afficher erreurs en rouge et succès ambassadeur en vert, avec validation
   silencieuse après saisie ;
8. après checkout, poller la licence : une redirection de succès n'est jamais
   une preuve de paiement et ne doit jamais activer l'accès ; seule la
   confirmation webhook Hub (`PAYMENT_CONFIRMED`) suivie d’un entitlement
   `valid: true` ouvre le contenu.
9. si le SaaS n’est pas déjà une PWA installable, configurer manifest + SW + icônes
   (Android, iOS, Desktop) sans cacher les routes Hub ;
10. exécuter le health check post-install (console + bannière UI) ;
11. connexion sans licence : bloquer l’app et afficher
    « Ce compte n'a pas de licence, veuillez acheter une licence ou bénéficier de l'essai gratuit »
    avec **Acheter une licence** et **Essai gratuit** ;
12. hors ligne : « Erreur de connexion, vérifiez votre connexion internet ».

## Principes non négociables

### Application ≠ Product
- `MBEUK_APPLICATION_ID` = identité technique SaaS
- `MBEUK_PRODUCT_ID` = identité commerciale/licence

### Auth ≠ Licence
- Login autorisé sans licence active
- Messages UX distincts : compte valide vs entitlement manquant vs paiement pending

### Paiement serveur
- Webhook / Pulse **Hub** (`/api/webhooks/chariow`) = preuve de paiement
- Redirection frontend ≠ preuve
- Sync via poll `hub-sync-license` / `hub-me` (snippet `poll-entitlement.snippet.js`)
- Pulse Chariow : URL Hub uniquement — **jamais** le SaaS
- Développeurs merchant : secret `whsec_…` dans Developer Portal → **/payments** (chiffré)
- Plateforme Hub : `CHARIOW_WEBHOOK_SECRET` sur Vercel Hub

### Secrets
- `MBEUK_HUB_API_KEY` serveur uniquement
- Jamais en `VITE_*` / `NEXT_PUBLIC_*`
- Ne jamais coller de secrets dans le chat
- Ne pas stocker `whsec_` / clés Chariow dans le SaaS

## Phase 6 — TEST

```bash
node scripts/validate/validate.mjs <saas-root>
npm test   # si disponible
npm run build
```

Tests manuels : register, login sans licence, trial, checkout, sync post-paiement, guard app, promo valide/invalide.

## Phase 7 — VALIDATE

Checklist :
- [ ] SDK installé
- [ ] hub.integration.json présent (`ownerType` platform|developer)
- [ ] Edge Functions hub-* déployables (dont hub-validate-promo si affiliate)
- [ ] Auth UI existante préservée (si applicable)
- [ ] Migrations SaaS appliquées
- [ ] Pas de secret dans dist/
- [ ] Auth ≠ entitlement séparés
- [ ] Pulse → Hub + secret Portal / Vercel documentés (actions manuelles)
- [ ] Poll post-paiement branché
- [ ] hub-diagnostics PASS (si configuré)

## Phase 8 — RAPPORT FINAL

Créer `SAAS-HUB-INTEGRATION-REPORT.md` avec :
- fichiers modifiés ;
- variables env à configurer ;
- actions manuelles Hub / Developer Portal ;
- tests exécutés / NOT EXECUTED ;
- limitations.

## Hub Central — corrections Performance (si tu touches au Hub)

Quand tu corriges / maintiens le Hub (pas le SaaS client), respecter :

### Classements Influenceurs (Admin → Performance)

1. **Volume (unités vendues)** : afficher le **nom réel** de chaque influenceur (`influencers.name`, sinon email / `promo_code`).  
   Interdit : libellé générique « Influenceur » répété pour toutes les lignes.
2. **CA / commissions (période)** : colonne = **somme de `commission_earned`** sur l’intervalle de dates choisi — **pas** le GMV `order_total`.  
   Exemple : 2 ventes × 10 000 à 25 % → commissions 2 × 2 500 = **5 000**.  
   Afficher aussi le **nom réel** de l’influenceur.
3. Produits : le CA produit reste le GMV (`order_total`) — ne pas confondre avec le montant commissions influenceur.
4. CA / ledger finance historique : **ne pas détruire** les écritures existantes ; corriger via gate / reconcile / backfill si besoin (FIX, DON'T REBUILD).

Fichiers de référence Hub : `lib/analytics/rankings.ts`, `app/dashboard/admin/performance/page.tsx`, `app/api/admin/performance/route.ts`.

## Hub Central — protection

Ne modifier Hub Central que pour un besoin **générique** :
- nouveau endpoint v1 réutilisable ;
- correction bug affectant tous les SaaS ;
- Performance / commissions / noms influenceurs (ci-dessus).

Toute modification Hub : justifiée, minimale, rétrocompatible, documentée.

## Distribution kit (Portal)

- Mettre à jour `MbeukSaaS-Integration-Kit` + bump `VERSION` / CHANGELOG.
- Rebuild `developer-portal/public/downloads/MbeukSaaS-Integration-Kit-vX.Y.Z.zip`.
- Pointer `developer-portal/src/lib/constants/sdk.ts` (`integrationKitVersion`, `integrationKitPath`).
- Page Portal **/sdk** : bouton **Télécharger le kit d’intégration (.ZIP)** (propriétaires + développeurs).
- Synchroniser aussi `PROMPT_CONNECT_SAAS_TO_HUB.md` et le guide HTML dans `/downloads`.

## Références kit

- `docs/HOW_TO_USE.md`
- `docs/integration-contract.md`
- `docs/integration-guide.md`
- `docs/architecture.md`
- `docs/security.md`
- `integration/hub.integration.template.json`

## Référence validation (pas dépendance)

MbeukAgri dans le monorepo Hub — comparer les patterns, ne pas copier le métier agricole.

## Interdictions

- Reconstruire le SaaS
- **Reconstruire une page auth déjà présente**
- Hardcoder IDs MbeukAgri
- Exposer secrets dans le chat ou le repo
- Simuler des tests réussis
- Supprimer l'intégration existante
- Effacer l’historique CA / ledger sans stratégie de migration non destructive
