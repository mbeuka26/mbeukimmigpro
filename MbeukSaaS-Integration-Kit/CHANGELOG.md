# Changelog — MbeukSaaS Integration Kit

## [1.8.0] — 2026-10-06

### Security
- Inscription et connexion renvoient `access_granted: true` uniquement si le
  Hub confirme explicitement une licence valide.
- Un compte sans licence est mis en cache avec le plan `none`, jamais
  `Professional`.
- Le message de synchronisation ne présente plus toute absence de licence comme
  un paiement en cours.
- Contrat renforcé : checkout et vente `pending` ne constituent jamais une
  preuve de paiement ; seule la confirmation serveur issue du webhook signé
  autorise une licence payante.

## [1.7.0] — 2026-09-14

### Security
- Accès Standard **uniquement** si le Hub confirme `valid: true` après webhook `PAYMENT_CONFIRMED`.
- `?payment=success` ne donne jamais la licence ; URL nettoyée, poll serveur seulement.
- Échec / annulation / abandon → statut `UNPAID`, compte non payé.

### Added
- Page d’interception licence : message exact + boutons **Acheter une licence** et **Essai gratuit**.
- Auth universelle : fond bleu foncé unifié, scène mécanique animée, description produit.
- Erreurs réseau : *Erreur de connexion, vérifiez votre connexion internet*.
- Secteur `mecanique` / `mechanical`.

### Changed
- `normalizeEntitlement` n’accepte plus `subscription.valid` seul.

## [1.6.0] — 2026-09-11

### Added
- **PWA automatique** si le SaaS n’est pas installable : `scripts/install/install-pwa.mjs` ajoute manifest, Service Worker, icônes 192/512 et `apple-touch-icon` (Android, iOS, Desktop).
- Aucune écrasement d’une PWA déjà présente (`vite-plugin-pwa`, Serwist, `sw.js`, manifest).
- SW kit : network-first HTML, **jamais** de cache des routes Hub / auth.
- Enregistrement SW + lien manifest au boot (`pwa.js`).
- **Health check** post-install (`scripts/health-check.mjs` + bannière UI) :
  - succès : *OK - Le kit et la PWA installable ont été bien connectés et vérifiés sans faille*
  - sinon liste précise (manifest, SW, icônes, clés, Gate, Hub injoignable).
- `apply-kit.mjs` enchaîne install PWA + health check.

### Changed
- `diagnose` / `validate` / `dry-run` détectent la PWA installable.

## [1.5.0] — 2026-09-11

### Added
- Kit **prêt second SaaS** : `scripts/install/apply-kit.mjs` + `install-barrier.mjs` (copie sans écraser l’auth).
- Overlay essai/achat aussi en `authMode: existing` si le compte est bloqué.
- `forgotPassword` / `logout` dans le client Gate + auth universelle.
- Alias de champs (`nom`, `mail`, `telephone`, `mot_de_passe`) pour formulaires existants.
- Masquage automatique des boutons « Renouveler la licence ».
- Promo silencieuse branchable sur un input existant ; `boot.js` point d’entrée unique.
- Template `SAAS-HUB-INTEGRATION-REPORT.md` et thèmes sectoriels (agri, commerce, education, santé).
- validate/diagnose acceptent plusieurs chemins de barrière.

### Changed
- `install-sdk.mjs` pointe toujours vers le `.tgz` du kit MbeukSaaS (plus de chemin NATEIVA).

## [1.4.0] — 2026-09-11

### Added
- `MbeukHubGate` universel : interception avant contenu protégé, machine d’état et API événementielle.
- Auth universelle de secours (connexion + inscription) quand le SaaS n’a aucune page auth.
- Nom utilisateur + badges **Essai gratuit** / **Standard** avec jours restants.
- Empreinte appareil non invasive, restauration d’accès après reconnexion et poll post-paiement.
- Validation silencieuse du code ambassadeur avec feedback rouge/vert.
- Tests de contrat de normalisation entitlement.

### Changed
- Prompt d’ingénierie enrichi avec la règle « barrière externe » et l’intégration chirurgicale.
- Validation et manifestes alignés sur la barrière frontend universelle.

### Security
- L’empreinte frontend reste un signal ; l’unicité essai et l’activation payante restent contrôlées serveur.
- Une redirection checkout ne donne jamais accès sans statut Hub valide après webhook.

## [1.3.0] — 2026-09-08

### Added
- Clarification kit **unifié** : même ZIP pour SaaS propriétaire (platform) et développeurs externes.
- Docs : commissions influenceur = somme `commission_earned` sur période (Performance Hub).
- Référence audit CA / ventes qualifiées (paiement + licence) — sans destruction historique.

### Changed
- Portal `/sdk` : libellés kit d’intégration explicites (propriétaire + développeur).
- Alignement VERSION 1.3.0 / distribution ZIP.

### SDK compatibility
- Requires `mbeuk-hub-sdk` >= 2.0.0
- Hub Central API `/api/v1`

## [1.2.0] — 2026-09-07

### Added
- Docs Pulse Chariow → **Hub Central uniquement** (`/api/webhooks/chariow`).
- Developer Portal : enregistrement sécurisé du secret Pulse `whsec_…` (chiffré) + sync Hub.
- Prompt / HOW_TO_USE : checklist paiement → licence → poll entitlement.

### Changed
- Renommage officiel du kit : **MbeukSaaS-Integration-Kit** (ex-NATEIVA).
- Adapter payment : secret merchant via Portal, jamais sur le SaaS.

### SDK compatibility
- Requires `mbeuk-hub-sdk` >= 2.0.0
- Hub Central API `/api/v1`

## [1.1.0] — 2026-09-06

### Added
- Templates Edge **complets** : `hub-auth-login`, `hub-auth-register`, `hub-auth-logout`,
  `hub-auth-forgot-password`, `hub-auth-refresh`, `hub-me`, `hub-checkout`,
  `hub-license-status`, `hub-sync-license`, `hub-diagnostics`, **`hub-validate-promo`**,
  `validate-trial` + script `deploy-edge-functions.sh`.
- Frontend bridge : `hub-affiliate.js`, snippets poll entitlement + messages auth/promo.
- Guide **`docs/HOW_TO_USE.md`** (connexion SaaS + Developer Portal).
- Codes auth Hub : `ACCOUNT_NOT_FOUND`, `WRONG_PASSWORD` (UX login).
- Message promo unifié : « Code promo invalide. Vérifiez le code et réessayez. »
- Distribution portail : ZIP téléchargeable sur `/sdk` (Developer Portal).

### Changed
- Manifest : `hub-validate-promo` dans commerce ; `affiliate` recommandé ; `postPayment` = poll.
- `saas-profile.ts` aligné MbeukAgri (préserve `full_name`).
- Parcours Marketplace documenté : **Installer-first** + propagation `?ref=` (pas Buy email-only).
- README / troubleshooting / adapters auth & payment mis à jour.

### Fixed (patterns issus prod Hub ↔ MbeukAgri)
- Faux message « Connexion réseau » quand `hub-validate-promo` non déployé.
- Checkout avec code promo vide + `link_ref` depuis `?ref=`.
- Polling post-paiement (redirect ≠ preuve de licence).

### SDK compatibility
- Requires `mbeuk-hub-sdk` >= 2.0.0 (codes auth additifs documentés)
- Hub Central API `/api/v1`

## [1.0.0] — 2026-09-02

### Added
- Kit initial extrait de l'intégration Hub Central ↔ MbeukAgri (référence).
- SDK officiel `mbeuk-hub-sdk@2.0.0` embarqué (`sdk/official/`).
- Templates : `hub.integration.template.json`, `env.example`, migrations Supabase SaaS.
- Modules `_shared` Edge Functions (hub-service, subscription-sync, hub-session-auth…).
- Scripts : `diagnose`, `validate`, `dry-run`, `install-sdk`.
- Documentation : architecture, contrat, déploiement, sécurité, compatibilité.
- Prompt autonome `prompts/integrate-saas.md`.
- Tests contrat manifest + fixture SaaS minimal fictif.
- CI template GitHub `ci-cd/github/saas-hub-integration.yml`.

### Reference
- Validation contre MbeukAgri (ownerType: platform, Supabase Edge Functions, Vite PWA).
- Aucun App ID / Product ID réel dans les templates.

### SDK compatibility
- Requires `mbeuk-hub-sdk` >= 2.0.0
- Hub Central API `/api/v1`
