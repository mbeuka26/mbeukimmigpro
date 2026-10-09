#!/usr/bin/env bash
# Pousse les secrets GitHub Actions vers Supabase Edge (supabase secrets set).
set -euo pipefail

required=(SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF)
for v in "${required[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "❌ Variable $v manquante"
    exit 1
  fi
done

export SUPABASE_ACCESS_TOKEN
cd "$(dirname "$0")/../.."

if ! command -v supabase >/dev/null 2>&1; then
  echo "❌ Supabase CLI requis"
  exit 1
fi

supabase link --project-ref "$SUPABASE_PROJECT_REF" --yes 2>/dev/null || true

# Secrets consommés par les Edge Functions (serveur uniquement)
declare -A SECRETS=(
  [MBEUK_ENVIRONMENT]="${MBEUK_ENVIRONMENT:-production}"
  [MBEUK_HUB_URL]="${MBEUK_HUB_URL:-}"
  [MBEUK_HUB_API_KEY]="${MBEUK_HUB_API_KEY:-}"
  [MBEUK_PRODUCT_ID]="${MBEUK_PRODUCT_ID:-}"
  [MBEUK_APPLICATION_ID]="${MBEUK_APPLICATION_ID:-}"
  [MBEUK_AUTH_BRIDGE_SECRET]="${MBEUK_AUTH_BRIDGE_SECRET:-}"
  [SUPABASE_SERVICE_ROLE_KEY]="${SUPABASE_SERVICE_ROLE_KEY:-}"
  [BYOK_MASTER_KEY_BASE64]="${BYOK_MASTER_KEY_BASE64:-}"
  [CENTRAL_OPENAI_API_KEY]="${CENTRAL_OPENAI_API_KEY:-}"
  [CENTRAL_ANTHROPIC_API_KEY]="${CENTRAL_ANTHROPIC_API_KEY:-}"
  [CENTRAL_GOOGLE_API_KEY]="${CENTRAL_GOOGLE_API_KEY:-}"
  [CENTRAL_XAI_API_KEY]="${CENTRAL_XAI_API_KEY:-}"
  [CENTRAL_OPENROUTER_API_KEY]="${CENTRAL_OPENROUTER_API_KEY:-}"
  [CENTRAL_MISTRAL_API_KEY]="${CENTRAL_MISTRAL_API_KEY:-}"
  [CRAWLER_CRON_SECRET]="${CRAWLER_CRON_SECRET:-}"
  [ADMIN_SECRET]="${ADMIN_SECRET:-}"
)

ARGS=()
for key in "${!SECRETS[@]}"; do
  val="${SECRETS[$key]}"
  if [[ -n "$val" ]]; then
    ARGS+=("${key}=${val}")
  fi
done

if [[ ${#ARGS[@]} -eq 0 ]]; then
  echo "⚠️ Aucun secret à pousser (tous vides)"
  exit 0
fi

echo "→ supabase secrets set (${#ARGS[@]} clés)"
supabase secrets set "${ARGS[@]}" --project-ref "$SUPABASE_PROJECT_REF"
echo "✅ Secrets Supabase synchronisés"
