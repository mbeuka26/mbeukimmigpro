#!/usr/bin/env bash
# Génère js/supabase-config.js pour le build Vercel (clés publiques anon).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
URL="${VITE_SUPABASE_URL:-${SUPABASE_URL:-}}"
ANON="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}"
if [[ -z "$URL" || -z "$ANON" ]]; then
  if [[ -f "$ROOT/js/supabase-config.js" ]]; then
    echo "⚠ Variables build absentes — réutilisation de js/supabase-config.js existant"
    exit 0
  fi
  echo "❌ VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requis pour le build frontend"
  exit 1
fi
mkdir -p "$ROOT/js"
cat > "$ROOT/js/supabase-config.js" <<EOF
/** Généré par CI — ne pas committer */
export const SUPABASE_URL = $(node -e "console.log(JSON.stringify(process.argv[1]))" "$URL");
export const SUPABASE_ANON_KEY = $(node -e "console.log(JSON.stringify(process.argv[1]))" "$ANON");
export const VITE_SUPABASE_URL = SUPABASE_URL;
export const VITE_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
EOF
echo "✅ js/supabase-config.js généré"
