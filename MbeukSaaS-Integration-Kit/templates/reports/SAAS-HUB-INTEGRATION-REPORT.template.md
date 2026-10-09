# Rapport d’intégration SaaS → Hub Central

**SaaS :** ${SAAS_NAME}  
**Kit :** MbeukSaaS-Integration-Kit 1.8.0
**Date :**

## 1. Fichiers ajoutés ou branchés

- `src/mbeuk-gate/` (barrière, ne remplace pas le métier)
- `hub.integration.json`
- Edge Functions `hub-*` (liste) :

## 2. Code métier d’origine

- [ ] Intact (aucune page métier réécrite)
- [ ] Auth existante conservée (si présente)
- [ ] Schéma métier non fusionné avec le Hub

## 3. Barrière Hub

- [ ] `bootMbeukHubGate()` appelé avant le bootstrap protégé
- [ ] Header : nom + badge Essai gratuit / Standard
- [ ] Overlay essai/achat si compte valide sans licence
- [ ] Promo `?ref=` + code manuel
- [ ] Poll post-paiement (redirect ≠ licence)
- [ ] Mot de passe oublié branché (formulaire existant ou overlay)

## 4. Secrets / Portal

- `MBEUK_HUB_URL` :
- `MBEUK_PRODUCT_ID` / `MBEUK_APPLICATION_ID` : renseignés hors git
- Pulse Chariow → Hub uniquement
- Secret `whsec_` : Portal /payments ou Vercel Hub

## 5. Tests

| Scénario | Résultat |
|---|---|
| Register | |
| Login sans licence | |
| Essai 1 email / 1 appareil | |
| Promo valide / invalide | |
| Checkout → webhook → accès Standard | |
| Wipe localStorage + reconnexion | |
| `node scripts/validate/validate.mjs` | |

## 6. Limitations

-
