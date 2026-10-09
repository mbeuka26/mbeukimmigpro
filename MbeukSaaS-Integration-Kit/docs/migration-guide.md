# Migrations — Guide

## Séparation obligatoire

| Cible | Où appliquer | Exemple |
|---|---|---|
| Hub Central | Supabase **Hub** | `access_type` sur `licenses` |
| SaaS | Supabase **du SaaS** | `profiles.hub_user_id`, cache `subscriptions` |

## Migrations SaaS incluses (templates/)

| Fichier | Rôle |
|---|---|
| `001_hub_integration.sql` | Colonnes Hub sur profiles/subscriptions, affiliate sessions |
| `002_hub_identity_clarification.sql` | Clarification identité Hub vs local |
| `003_licenses_access_type_compat.sql` | Compat cache access_type |

## Ordre d'application

1. Backup base SaaS
2. Appliquer 001 → 002 → 003 dans l'ordre
3. Vérifier RLS policies
4. Déployer Edge Functions **après** migrations

## Hub Central (manuel)

Consulter `docs/AUDIT_INTEGRATION_MBEUKAGRI.md` section migrations Hub.

Ne pas automatiser en prod sans revue DBA.

## Rollback

- Migrations additives uniquement dans le kit (pas de DROP destructif).
- Rollback = nouvelle migration corrective, pas `down` aveugle.
