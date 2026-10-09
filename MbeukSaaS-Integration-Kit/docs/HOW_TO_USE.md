# Comment connecter un SaaS au Hub Central (kit 1.8.0)

Ce kit sert **tous** les SaaS (plateforme NATEIVA **et** développeurs externes).  
Le Developer Portal pilote : clé API, applications, profil marketplace, téléchargement du kit, **config Chariow** (clé API + secret Pulse).  
Le Hub Central reste l’autorité : identité, licences, paiements, commissions, **webhooks**.

## 1. Prérequis côté Hub / Portal

1. Compte **Developer Portal** actif.
2. Une **application SaaS** créée + produit(s) tarifés.
3. Une clé API Hub `mbs_…` (page **/sdk** du portal) avec scopes :
   - `auth:login`, `auth:register`, `licenses:read`, `licenses:write`, `checkout:write`
   - + `influencers:read` si affiliation / code promo
4. `MBEUK_PRODUCT_ID` et `MBEUK_APPLICATION_ID` (UUID Hub) renseignés.
5. **Paiements Chariow (mode merchant)** :
   - Portal → **/payments** : clé API Chariow `sk_…` + secret Pulse `whsec_…`
   - Créer un **Pulse** Chariow vers :
     `https://mbeukhub.vercel.app/api/webhooks/chariow`
   - **Ne jamais** pointer le Pulse vers votre SaaS — la licence est créée par le Hub.

## 2. Installer le kit dans votre SaaS

```bash
# Dézipper MbeukSaaS-Integration-Kit-v1.8.0.zip à côté de votre projet
cd /chemin/vers/mon-saas

# Option A — SDK seul (léger)
npm install ./chemin/vers/kit/sdk/official/mbeuk-hub-sdk-2.0.0.tgz

# Option B — scripts kit (recommandé pour un second SaaS)
node /chemin/vers/kit/scripts/dry-run.mjs .
node /chemin/vers/kit/scripts/install/apply-kit.mjs .
cp /chemin/vers/kit/integration/hub.integration.template.json ./hub.integration.json
cp /chemin/vers/kit/integration/env.example ./.env.example
```

Remplissez les secrets **Edge Functions / backend uniquement** (jamais `NEXT_PUBLIC_` / `VITE_` pour la clé API).

## 3. Edge Functions (Supabase)

```bash
# Copier templates
cp -r kit/templates/supabase/migrations/* supabase/migrations/
cp -r kit/templates/supabase/edge-functions/_shared supabase/functions/_shared
cp -r kit/templates/supabase/edge-functions/hub-* supabase/functions/
cp kit/templates/supabase/edge-functions/validate-trial supabase/functions/
cp kit/templates/supabase/deploy-edge-functions.sh scripts/

# Secrets Supabase
supabase secrets set MBEUK_HUB_URL=... MBEUK_HUB_API_KEY=mbs_... \
  MBEUK_PRODUCT_ID=... MBEUK_APPLICATION_ID=... \
  MBEUK_AUTH_BRIDGE_SECRET=... MBEUK_SERVICE_ROLE_KEY=...

bash scripts/deploy-edge-functions.sh
```

**Obligatoire si affiliation :** déployer `hub-validate-promo` (inclus dans le script).

## 4. Frontend minimum

| Fichier kit | Rôle |
|---|---|
| `templates/frontend/universal-barrier/boot.js` | Point d’entrée unique `bootMbeukHubGate()` |
| `templates/frontend/central-saas/hub-affiliate.js` | Capture `?ref=`, code promo manuel, payload checkout |
| `templates/frontend/central-saas/poll-entitlement.snippet.js` | Polling post-paiement (redirect ≠ licence) |
| `templates/frontend/central-saas/auth-messages.snippet.js` | Messages login / promo UX |

Installer `MbeukHubGate` avant le bootstrap du SaaS et définir le sélecteur du
contenu protégé. Si une page auth existe, la conserver et utiliser
`bindExistingAuth()`. Utiliser `authMode: "universal"` uniquement en l’absence
totale d’auth. Voir `templates/frontend/universal-barrier/README.md`.

Le header reçoit le nom du profil Hub et :

- **Essai gratuit · N j** pour un essai valide ;
- **Standard** pour une licence payante active.

Les états `checking`, `anonymous`, `blocked` ou `error` n’ouvrent jamais le
contenu métier. Une URL `?payment=success` ne suffit jamais : seul le webhook
Hub (`PAYMENT_CONFIRMED`) active Standard. Échec / abandon = compte `unpaid`.

Sans licence, après connexion, la barrière affiche :
« Ce compte n'a pas de licence, veuillez acheter une licence ou bénéficier de l'essai gratuit »
avec les boutons **Acheter une licence** et **Essai gratuit**.

Hors ligne : « Erreur de connexion, vérifiez votre connexion internet ».

## 4b. PWA installable et health check

Si le projet n’a **pas** encore de PWA, `apply-kit` / `install-pwa.mjs` ajoute :

- `public/manifest.webmanifest`
- `public/mbeuk-sw.js` (aucun cache des routes Hub / auth)
- icônes 192 / 512 + `apple-touch-icon` (Android, iPhone, Desktop)

Une PWA déjà présente (`vite-plugin-pwa`, Serwist, `sw.js`) n’est **jamais** écrasée.

Après installation, `scripts/health-check.mjs` écrit `public/mbeuk-kit-health.html`.
Au boot, une bannière UI + la console affichent soit le message de succès exact,
soit la liste des manques (manifest, clés, Hub injoignable, etc.).

`bootMbeukHubGate()` enregistre le Service Worker et relance le health check navigateur.
Après effacement du LocalStorage, une reconnexion interroge le Hub (`hub-me`) pour
restaurer l’accès si la licence est valide.

Parcours **officiel Marketplace** :

```text
Lien influenceur Hub/?ref=ID
  → Marketplace Installer (propage ?ref=)
  → SaaS /auth?ref=ID  (compte email+mdp)
  → Acheter (code promo facultatif si ref déjà capturé)
  → Checkout Hub → Pulse webhook Hub → licence
  → poll entitlement → PRO
```

Ne pas compter sur un « Acheter email-only » Marketplace pour créer le compte SaaS.

## 5. Codes d’erreur auth (UX)

| Situation | Code Hub / Edge | Message client recommandé |
|---|---|---|
| Email mal formé | (client) | Email invalide. Saisissez correctement votre email… |
| Email inconnu | `ACCOUNT_NOT_FOUND` | Vérifiez votre email et mot de passe. |
| Mauvais mot de passe | `WRONG_PASSWORD` | Vérifiez votre mot de passe. |
| Autre échec login | `INVALID_CREDENTIALS` | Identifiant invalide. Vérifiez votre mot de passe. |
| Code promo faux | `PROMO_NOT_FOUND` | Code promo invalide. Vérifiez le code et réessayez. |
| Code promo OK | — | Réussi — paiements avec le code de « Nom ». → checkout |

## 6. Affiliation

- **Manuel** : `promo_code` (priorité)
- **Lien** : `link_ref` depuis `?ref=` / sessionStorage
- Code **vide** = OK si `link_ref` présent
- Valider via Edge `hub-validate-promo` → Hub `POST /api/v1/affiliate/validate`

## 7. Piloter depuis le Developer Portal

Oui : le même kit sert les développeurs externes.

| Action | Où |
|---|---|
| Télécharger **kit d’intégration ZIP** (même archive v1.8.0) | Portal → **/sdk** **ou** Hub Super Admin → **Kit d'intégration** |
| Créer clé API | Portal → **/sdk** |
| Chariow API + Pulse `whsec_` | Portal → **/payments** |
| Apps / tarifs / profil marketplace | Portal → Applications |
| Publication / revue | Workflow Hub (publication Super Admin selon mode plateforme) |
| Revenus / ventes | APIs Hub + tableaux portal (selon droits) |

Le kit **ne remplace pas** le portal : il **branche** le SaaS.  
Le portal **pilote** la clé, l’app, le listing, Chariow ; le Hub **exécute** auth/licence/paiement/webhook.

## 8. Checklist go-live

- [ ] `hub.integration.json` rempli (`affiliate: true` si besoin)
- [ ] Secrets Edge OK
- [ ] Toutes les `hub-*` déployées **dont** `hub-validate-promo`
- [ ] Register / login / essai / achat / sync testés
- [ ] Lien `?ref=` → Installer → SaaS conserve le ref
- [ ] Pulse Chariow → URL Hub + `whsec_` dans Portal **/payments** (et `CHARIOW_WEBHOOK_SECRET` Vercel Hub pour le store plateforme)
- [ ] Après paiement : poll entitlement → accès PRO
- [ ] PWA installable (manifest + SW) — `apply-kit` la configure si absente
- [ ] Health check : message *OK - Le kit et la PWA installable ont été bien connectés et vérifiés sans faille*
- [ ] `node scripts/validate/validate.mjs .` vert

## 9. Prompt IA

Utilisez `prompts/integrate-saas.md` dans Cursor avec ce ZIP + votre repo SaaS.  
Ne collez **jamais** de secrets dans le chat.
