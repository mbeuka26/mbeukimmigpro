# Authentification clients

Le Hub Central est la source d’autorité pour les comptes **par produit** (Option 0-A).

## Flux

```text
register(email, password, product_id, start_trial?)
        ↓
login → session_token + refresh_token + license
        ↓
refreshSession / logout / forgotPassword / revokeDevice
```

## Méthodes SDK

- `hub.auth.register`
- `hub.auth.login`
- `hub.auth.refreshSession`
- `hub.auth.forgotPassword` / `resetPassword`
- `hub.auth.logout`
- `hub.auth.revokeDevice`

## Règles

1. Compte **obligatoire** avant trial.
2. Même email + autre `product_id` = autre compte.
3. Quota appareils : si `device_limit_reached` → UI appareils, **pas** checkout.
4. Licence expirée → checkout avec le **même** email (pas de nouveau register).
5. Adapter l’auth existante du SaaS ; ne pas la supprimer sans analyse (voir prompt d’intégration).

## Architecture SaaS

Le navigateur appelle **vos** routes `/api/...` ; celles-ci appellent le Hub avec le SDK.
