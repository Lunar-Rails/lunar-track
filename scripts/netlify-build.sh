#!/usr/bin/env bash
# Netlify production build: apply pending Supabase migrations, then build Next.js.
set -euo pipefail

run_migrations() {
  echo "Applying pending database migrations..."
  npx supabase db push --db-url "$SUPABASE_POOLER" --include-all
}

if [ -n "${SUPABASE_POOLER:-}" ]; then
  run_migrations
elif [ "${CONTEXT:-}" = "production" ]; then
  echo "ERROR: SUPABASE_POOLER must be set in Netlify environment variables for production deploys."
  echo "Use the Supabase connection pooler URL (Settings → Database → Connection string, pooler mode)."
  exit 1
else
  echo "Skipping database migrations (SUPABASE_POOLER unset, CONTEXT=${CONTEXT:-unknown})."
fi

echo "Building Next.js app..."
npm run build
