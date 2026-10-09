#!/usr/bin/env bash
# Déploie toutes les Edge Functions depuis supabase/edge-functions/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d supabase/edge-functions ]; then
  echo "❌ supabase/edge-functions introuvable"
  exit 1
fi

# Supabase CLI attend supabase/functions — lien symbolique si absent
if [ ! -e supabase/functions ]; then
  ln -s edge-functions supabase/functions
  echo "→ Lien supabase/functions → edge-functions créé"
fi

FUNCTIONS=(
  hub-auth-login hub-auth-register hub-auth-logout hub-auth-forgot-password hub-auth-refresh
  hub-me hub-checkout hub-license-status hub-sync-license hub-diagnostics hub-validate-promo
  validate-license validate-trial register-device renew-subscription
  api-proxy admin-list-users admin-update-user send-license-email
  generate-licenses import-export-licenses hub-register
)

for fn in "${FUNCTIONS[@]}"; do
  if [ -d "supabase/edge-functions/$fn" ]; then
    echo "→ Déploiement $fn"
    supabase functions deploy "$fn" --no-verify-jwt=false
  else
    echo "⚠️  Fonction $fn absente — ignorée"
  fi
done

echo "✅ Déploiement Edge Functions terminé"
