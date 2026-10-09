#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN requis}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF requis}"

export SUPABASE_ACCESS_TOKEN
supabase link --project-ref "$SUPABASE_PROJECT_REF" --yes 2>/dev/null || true

SDK_SRC="MbeukSaaS-Integration-Kit/sdk/official/dist/index.js"
VENDOR_DIR="supabase/functions/vendor/mbeuk-hub-sdk"
if [[ ! -f "$SDK_SRC" ]]; then
  echo "❌ SDK Hub introuvable: $SDK_SRC"
  exit 1
fi
mkdir -p "$VENDOR_DIR"
cp "$SDK_SRC" "$VENDOR_DIR/index.js"
echo "✓ Vendor mbeuk-hub-sdk → $VENDOR_DIR/index.js"

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
