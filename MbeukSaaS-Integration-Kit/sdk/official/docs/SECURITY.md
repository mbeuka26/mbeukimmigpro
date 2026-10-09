# Sécurité

## Autorité

| Couche | Rôle |
|--------|------|
| Frontend | UI |
| Backend SaaS + SDK | Pont authentifié |
| Hub Central | Autorité licences / paiement / commissions |

## Multi-tenant

Clé API → `saas_app_id` → produits/licences de **cette** app uniquement.

## Ne jamais logger

- `mbs_…` complets
- mots de passe
- secrets Chariow
- tokens admin

## Erreurs

Utiliser `MbeukHubError.code` (`HubErrorCodes`) — messages génériques côté client final.
