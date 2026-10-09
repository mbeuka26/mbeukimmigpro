# Compatibilité

## Matrice versions

| Integration Kit | SDK | Hub API | Node |
|---|---|---|---|
| 1.8.0 | 2.0.0 | v1 | >= 18 |
| 1.8.0 | 2.0.0 | v1 | >= 18 |
| 1.6.0 | 2.0.0 | v1 | >= 18 |
| 1.5.0 | 2.0.0 | v1 | >= 18 |
| 1.0.0 | 2.0.0 | v1 | >= 18 |

## Frameworks testés (référence)

| Framework | Statut | Référence |
|---|---|---|
| Vite + PWA | ✅ Validé | MbeukAgri |
| Next.js client | ✅ Barrière ESM | `universal-barrier` (backend à adapter) |
| Vue / Angular | ✅ Barrière ESM | `universal-barrier` (backend à adapter) |
| Laravel PHP | ⚠️ Adapter requis | SDK utilisable côté PHP via HTTP direct |

## Backend auth

| Backend | Statut |
|---|---|
| Supabase Edge Functions | ✅ Référence complète |
| Next.js API Routes | ⚠️ Porter hub-service.ts |
| Express / Fastify | ⚠️ Porter hub-service.ts |

## Comparaison SDK externe

Si l'utilisateur fournit un SDK `.tgz` séparé :

1. Exécuter `node scripts/diagnose/diagnose.mjs`
2. Comparer version avec `sdk/official/package.json`
3. **Ne pas écraser** automatiquement — privilégier le SDK du kit sauf instruction explicite.

## Breaking changes

Voir [CHANGELOG.md](../CHANGELOG.md).
