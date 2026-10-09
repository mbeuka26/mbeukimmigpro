# MbeukHubGate — barrière frontend universelle (kit 1.8.0)

Couche externe. Ne remplace ni le métier, ni la base, ni les pages auth existantes.

## Installation en 2 commandes

```bash
node scripts/install/apply-kit.mjs /chemin/vers/mon-saas
```

Puis dans le SaaS :

1. Header existant : `<div id="hub-user-status" aria-live="polite"></div>`
2. Bootstrap :

```js
import { bootMbeukHubGate } from "./mbeuk-gate/boot.js";

await bootMbeukHubGate({
  productName: "Mon SaaS",
  productDescription: "Résumé produit affiché sur la page de connexion.",
  sector: "mecanique", // agri | commerce | education | sante | mecanique | generic
  authMode: "existing", // "universal" seulement si aucune page auth
});
```

Sélecteurs reconnus automatiquement : `#login-form`, `#register-form`, `#forgot-form`,
`input[name=promo_code]`, `[data-mbeuk-checkout]`, `[data-mbeuk-trial]`, `[data-mbeuk-logout]`.

## Fichiers

- `boot.js` — point d’entrée unique (PWA + health check)
- `gate-messages.js` — messages licence / réseau
- `pwa.js` — manifest dynamique + enregistrement SW (sans doublon)
- `health-check.js` — bannière succès / liste d’erreurs
- `mbeuk-hub-gate.js` — machine d’état
- `hub-gate-client.js` — Edge hub-*
- `device-fingerprint.js`
- `mbeuk-hub-gate.css`

## Règles couvertes

- Auth existante conservée (`bindExistingAuth`)
- Connexion sans licence : blocage + message exact + **Acheter une licence** / **Essai gratuit**
- Overlay essai/achat si connecté sans licence (même en mode existing)
- Auth universelle : fond bleu foncé, scène mécanique, description produit
- Erreur réseau : *Erreur de connexion, vérifiez votre connexion internet*
- Mot de passe oublié + logout
- Badges nom + Essai gratuit / Standard
- `?ref=` + promo silencieuse (rouge/vert)
- Masquage « Renouveler la licence »
- Poll post-paiement : redirect ≠ licence
- Wipe storage → reconnexion Hub
- PWA installable configurée par le kit si absente
- Health check UI/console post-boot
