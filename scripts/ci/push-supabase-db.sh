#!/usr/bin/env bash
set -euo pipefail
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF requis}"
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN requis}"

export SUPABASE_ACCESS_TOKEN
supabase link --project-ref "$SUPABASE_PROJECT_REF" --yes

echo "→ supabase db push (non-interactif)"
set +e
OUT=$(supabase db push --linked --yes 2>&1)
CODE=$?
set -e
echo "$OUT"

if [[ "$CODE" -eq 0 ]]; then
  echo "✅ Migrations appliquées"
  exit 0
fi

if echo "$OUT" | grep -qE 'already exists|duplicate key|SQLSTATE 42P07'; then
  echo "⚠ Schéma partiellement présent — tentative migration repair puis re-push"
  for rev in 20261009000000 20261009010000 20261009020000 20261009030000; do
    supabase migration repair "$rev" --status applied --linked 2>/dev/null || true
  done
  supabase db push --linked --yes
  echo "✅ db push terminé après repair"
  exit 0
fi

echo "❌ db push échoué"
exit "$CODE"
