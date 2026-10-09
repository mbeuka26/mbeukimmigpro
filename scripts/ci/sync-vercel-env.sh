#!/usr/bin/env bash
# Synchronise les variables frontend vers Vercel (production + preview).
set -euo pipefail

: "${VERCEL_TOKEN:?VERCEL_TOKEN requis}"

cd "$(dirname "$0")/../.."

if ! command -v vercel >/dev/null 2>&1; then
  echo "❌ Vercel CLI requis"
  exit 1
fi

export VERCEL_ORG_ID="${VERCEL_ORG_ID:-}"
export VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-}"

# Uniquement variables publiques / build — jamais de clés Hub ou service_role
declare -A ENV_VARS=(
  [VITE_SUPABASE_URL]="${VITE_SUPABASE_URL:-${SUPABASE_URL:-}}"
  [VITE_SUPABASE_ANON_KEY]="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}"
)

upsert_env() {
  local key="$1"
  local val="$2"
  local target="$3"
  [[ -z "$val" ]] && return 0
  echo "→ vercel env rm $key $target (si existe)"
  vercel env rm "$key" "$target" --yes --token "$VERCEL_TOKEN" 2>/dev/null || true
  echo "→ vercel env add $key $target"
  printf '%s' "$val" | vercel env add "$key" "$target" --token "$VERCEL_TOKEN"
}

for key in "${!ENV_VARS[@]}"; do
  val="${ENV_VARS[$key]}"
  upsert_env "$key" "$val" production
  upsert_env "$key" "$val" preview
done

echo "✅ Variables Vercel synchronisées"
