#!/usr/bin/env bash
# Netlify build: apply pending Supabase migrations, then build Next.js.
set -euo pipefail

if [ -n "${SUPABASE_POOLER:-}" ]; then
  echo "Applying pending database migrations..."
  npx supabase db push --db-url "$SUPABASE_POOLER" --include-all --yes
else
  echo "SUPABASE_POOLER not set — skipping migrations."
fi

echo "Building Next.js app..."
npm run build
