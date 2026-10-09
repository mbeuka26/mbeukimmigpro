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

VERCEL_FLAGS=(--token "$VERCEL_TOKEN" --yes --force --no-sensitive)
if [[ -n "${VERCEL_PROJECT_ID:-}" ]]; then
  VERCEL_FLAGS+=(--project "$VERCEL_PROJECT_ID")
fi

# Uniquement variables publiques / build — jamais de clés Hub ou service_role
declare -A ENV_VARS=(
  [VITE_SUPABASE_URL]="${VITE_SUPABASE_URL:-${SUPABASE_URL:-}}"
  [VITE_SUPABASE_ANON_KEY]="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}"
)

upsert_env() {
  local key="$1"
  local val="$2"
  local target="$3"
  [[ -z "$val" ]] && { echo "⚠ skip $key ($target): valeur vide"; return 0; }
  echo "→ vercel env rm $key $target"
  vercel env rm "$key" "$target" "${VERCEL_FLAGS[@]}" 2>/dev/null || true
  echo "→ vercel env add $key $target"
  vercel env add "$key" "$target" "${VERCEL_FLAGS[@]}" --value "$val"
}

for key in "${!ENV_VARS[@]}"; do
  val="${ENV_VARS[$key]}"
  upsert_env "$key" "$val" production
  upsert_env "$key" "$val" preview
done

echo "✅ Variables Vercel synchronisées"
