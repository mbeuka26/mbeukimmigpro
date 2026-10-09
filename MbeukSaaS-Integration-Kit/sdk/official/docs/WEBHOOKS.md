# Webhooks

Les webhooks **Chariow → Hub Central** sont gérés par la plateforme.

Le SaaS développeur **ne reçoit pas** le webhook Chariow directement pour activer une licence.

## Ce que fait le Hub

1. Vérifie la signature
2. Idempotence (`webhook_events`)
3. Matching vente (`sale_id` / `product_id`+email)
4. Réconciliation montant
5. Licence paid + commissions

## Ce que fait le SaaS

- Initier le checkout via SDK
- Sur page succès / polling : `validateLicense` / `sync` / `login`
- Ne jamais « confirmer le paiement » localement

## Idempotence

Un même événement Chariow ne crée qu’**une** licence et **une** commission (géré Hub).
