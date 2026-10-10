# Rapport — Parcours Hub vs kit MbeukSaaS-Integration-Kit

Référence : `MbeukSaaS-Integration-Kit/integration/hub.integration.template.json`, `docs/GUIDE_CONNEXION_SAAS_HUB_A_Z.html`, barrière `src/mbeuk-gate/`.

## Ce que le kit impose (autorité Hub)

| Étape | Flux officiel kit | Implémentation MbeukImmig Pro |
|--------|-------------------|-------------------------------|
| Inscription | Frontend → **`hub-auth-register`** → Hub `auth.register` → profil SaaS → sync entitlement | `auth.html` → Edge `hub-auth-register` → redirect **`choose-access.html`** si session OK sans PRO |
| Connexion | Frontend → **`hub-auth-login`** → session Hub **≠** licence | `auth.html` ; si BLOCKED → **`choose-access.html?reason=unpaid\|expired`** |
| Choix accès | Essai **ou** achat (séparé de la session) | **`choose-access.html`** : essai 1j / achat licence |
| Essai | **`validate-trial`** → Hub `licenses.startTrial` | Bouton essai → `startTrial()` → entitlement **TRIAL** → **`platform.html`** |
| Achat | Promo optionnel → **`hub-checkout`** → Chariow → **webhook Hub** | **`promo.html`** → checkout ; PRO seulement après webhook (`hub-sync-license`) |
| Retour paiement | Page succès **≠** preuve | Pas d’accès sur redirect seul ; polling / statut licence |
| Expiration essai | Entitlement expiré → renouveler | Login → `choose-access.html?reason=expired` + message + boutons essai / achat |

## Pages produit (couche au-dessus du kit)

```text
auth.html          → Connexion / Créer compte (Hub)
choose-access.html → Essai gratuit OU Acheter licence
promo.html         → Code ambassadeur (facultatif) → checkout
platform.html      → Métier (ImmiPro / CV / Agent IA) si TRIAL ou STANDARD
```

Le kit recommande **`authMode: existing`** (écrans dédiés) plutôt que l’overlay `universal` lorsque des pages auth existent — c’est le cas ici.

## Secrets serveur requis (kit + Edge)

- `MBEUK_HUB_URL`, `MBEUK_HUB_API_KEY`, `MBEUK_PRODUCT_ID`
- `MBEUK_AUTH_BRIDGE_SECRET` (32+ caractères)
- `SUPABASE_SERVICE_ROLE_KEY` (bridge RLS)
- **`APP_URL`** : origines CORS (ex. `https://immig.mbeuk.co`, sans slash final ; plusieurs URLs séparées par des virgules)

## Fonctions auth publiques

Déployées avec **`--no-verify-jwt`** : `hub-auth-login`, `hub-auth-register`, `hub-auth-forgot-password`, `hub-ping` (inscription avant session JWT utilisateur).

## Écarts connus / configuration Hub

- **Durée essai 1 jour** : définie côté **produit Hub Central**, pas dans le frontend.
- **Licence payante ~3 ans** : durée commerciale Hub / webhook ; le frontend lit `hub-license-status` / entitlement **STANDARD**.

## Vérification manuelle recommandée

1. Inscription → redirection choix d’accès (pas d’erreur réseau).
2. Essai → accès immédiat `platform.html`.
3. Achat → promo → checkout ; sans webhook → login renvoie choix d’accès `unpaid`.
4. Après webhook OK → login → PRO.
5. Essai expiré → login → message expiration + achat / essai.
