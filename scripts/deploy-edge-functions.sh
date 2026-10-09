#!/usr/bin/env bash
# Déploiement local ou CI — toutes les fonctions sous supabase/functions/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
export SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
exec bash "$ROOT/scripts/ci/deploy-supabase-functions.sh"
