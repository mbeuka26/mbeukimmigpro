# Auth Adapter

Pont entre l'auth existante du SaaS et Hub Central.

## Pattern référence (Supabase Edge)

- `hub-auth-login` / `hub-auth-register` → Hub `/api/v1/auth/*`
- `hub-session-auth.ts` → validation JWT bridge + RLS
- Frontend : `AuthService.login()` retourne `{ allowed, sessionOk, reason }`
- Templates inclus : `templates/supabase/edge-functions/hub-auth-*`
- Messages UX : `templates/frontend/central-saas/auth-messages.snippet.js`

## Codes login (kit 1.4.0)

| Code | Message client |
|---|---|
| `ACCOUNT_NOT_FOUND` | Vérifiez votre email et mot de passe. |
| `WRONG_PASSWORD` | Vérifiez votre mot de passe. |
| `INVALID_CREDENTIALS` | Identifiant invalide. Vérifiez votre mot de passe. |

Email mal formé : valider **côté client** avant l’appel.

## Règle critique

**Ne pas refuser le login** si `LICENSE_NOT_FOUND` ou `no_entitlement`.

## Adapter autres frameworks

| Framework | Approche |
|---|---|
| Next.js API | Porter `hub-service.ts` en route handler |
| Express | Middleware session + service Hub |
| Laravel | Service `MbeukHubService` via SDK HTTP |

Voir `templates/supabase/edge-functions/_shared/hub-service.ts`.
