#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN requis}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF requis}"

export SUPABASE_ACCESS_TOKEN
supabase link --project-ref "$SUPABASE_PROJECT_REF" --yes 2>/dev/null || true

FUNCS_DIR="supabase/functions"
if [[ ! -d "$FUNCS_DIR" ]]; then
  echo "❌ $FUNCS_DIR introuvable"
  exit 1
fi

DEPLOYED=0
SKIPPED=0
for dir in "$FUNCS_DIR"/*; do
  name="$(basename "$dir")"
  [[ "$name" == "_shared" || "$name" == "README.md" ]] && continue
  [[ -f "$dir/index.ts" ]] || continue
  echo "→ Deploy $name"
  supabase functions deploy "$name" --project-ref "$SUPABASE_PROJECT_REF"
  DEPLOYED=$((DEPLOYED + 1))
done

echo "✅ Edge Functions déployées: $DEPLOYED (skipped metadata: $SKIPPED)"
