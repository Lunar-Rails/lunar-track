# External Integrations

LunarTrack integrates with Supabase (auth + database), Slack (scheduled DM reminders), and Resend (email notifications), deployed on Netlify.

**Analysis Date:** 2026-05-23

---

## Authentication & Identity

**Auth Provider:** Supabase Auth + Google OAuth
- Pattern: Supabase SSR (`@supabase/ssr ^0.10.2`) — the only supported pattern for Next.js App Router
- OAuth callback route: `src/app/auth/callback/route.ts`
- Auth guard in: `src/app/(protected)/layout.tsx`
- Login page: `src/app/login/`
- No username/password login; Google OAuth only
- Profile provisioning via `upsert_profile_on_login` RPC: `src/lib/supabase/server.ts`

**Client creation patterns:**
- Browser (Client Components): `src/lib/supabase/client.ts` — `createBrowserClient<Database>(...)`
- Server (Server Components / Actions): `src/lib/supabase/server.ts` — `createServerClient<Database>(...)` with async `cookies()`

---

## Data Storage

**Database:** Supabase PostgreSQL (managed)
- Client: `@supabase/supabase-js ^2.104.0` with typed `Database` interface from `src/lib/types/database.ts`
- RLS (Row-Level Security) enforces three-tier access model (Employee / Manager / HR Admin) at the database layer
- Complex queries via `supabase.rpc()` calls (e.g. recursive hierarchy, profile provisioning)
- Schema migrations managed via Supabase CLI: `supabase/` directory, push command in `package.json` (`supabase:push:new` uses `SUPABASE_POOLER` env var)
- Service role key used in Netlify scheduled function (`SUPABASE_SERVICE_ROLE_KEY`) — bypasses RLS intentionally for server-side reminder queries

**File Storage:** Not detected — no Supabase Storage or S3 references found

**Caching:** None detected

---

## Messaging & Notifications

**Email:** Resend
- Package: `resend ^6.12.3`
- Integration layer: `src/lib/notifications.ts`
- Uses direct `fetch('https://api.resend.com/emails', ...)` (raw HTTP, not Resend SDK client)
- Required env vars:
  - `RESEND_API_KEY` — API key
  - `RESEND_FROM` — sender address

**Slack DM Reminders:**
- Custom integration — no Slack SDK; raw Slack Web API calls via `fetch`
- Integration layer: `src/lib/slack.ts`
- Bot token scopes required per workspace: `users:read.email`, `im:write`, `chat:write`
- Multi-workspace support: token map keyed by email domain (`SLACK_WORKSPACE_TOKENS` JSON)
- Reminder logic: `src/lib/reminder-logic.ts`
- Delivery mechanism: Netlify scheduled function `netlify/functions/slack-reminders.mts`
  - Schedule: daily at 09:00 UTC (`cron: '0 9 * * *'`)
  - Sends DMs on reminder days (month-end check-in prompts, quarterly prompts)

---

## Analytics & Monitoring

**Error Tracking:** Not detected (no Sentry, Datadog, etc.)

**Analytics:** Not detected (no GA, Posthog, Mixpanel, etc.)

**Logs:** `console.log` / `console.error` only; structured with `[module]` prefixes (e.g. `[slack-reminders]`, `[supabase/server]`, `[notifications]`)

---

## Deployment Platform

**Hosting:** Netlify
- Config: `netlify.toml`
- Adapter: `@netlify/plugin-nextjs ^5.15.11` (dev dep)
- Build: `npm run build` → publishes `.next/`
- Node.js version: 20 (pinned in `netlify.toml`)
- Scheduled functions bundled with esbuild from `netlify/functions/` directory
- Functions type: `@netlify/functions ^5.2.2`

**CI Pipeline:** Not detected (no GitHub Actions, CircleCI configs found)

---

## Environment Variables

### Required (Next.js App)

| Variable | Used In | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | `netlify/functions/slack-reminders.mts` | Service role — bypasses RLS for scheduled jobs |
| `RESEND_API_KEY` | `src/lib/notifications.ts` | Resend email API key (server-only) |
| `RESEND_FROM` | `src/lib/notifications.ts` | Sender email address |
| `NEXT_PUBLIC_APP_URL` | `netlify/functions/slack-reminders.mts` | App base URL for links in DMs |
| `NEXT_PUBLIC_SITE_URL` | App code | Site URL (likely auth redirect) |

### Required (Netlify Functions only)

| Variable | Purpose |
|----------|---------|
| `SLACK_WORKSPACE_TOKENS` | JSON map of email domain → Slack bot token (e.g. `{"bcomm.com": "xoxb-..."}`) |
| `REMINDER_DATE_OVERRIDE` | Optional: override today's date for testing reminder logic (ISO date string) |
| `SUPABASE_POOLER` | Supabase connection pooler URL for CLI schema push (`npm run supabase:push:new`) |

### Public vs Server-only

- `NEXT_PUBLIC_*` variables are browser-exposed; contain only public Supabase endpoints and app URLs — no secrets
- `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SLACK_WORKSPACE_TOKENS` are server-only; never prefixed `NEXT_PUBLIC_`

---

## Webhooks & Callbacks

**Incoming:**
- `src/app/auth/callback/route.ts` — Supabase OAuth callback (Google SSO redirect URI)

**Outgoing:**
- Slack Web API (`https://slack.com/api`) — called from Netlify scheduled function
- Resend API (`https://api.resend.com/emails`) — called from Server Actions via `src/lib/notifications.ts`

---

## SDK Wrappers / Integration Layers

| File | Wraps | Notes |
|------|-------|-------|
| `src/lib/supabase/client.ts` | `@supabase/ssr` `createBrowserClient` | Typed with `Database` generic |
| `src/lib/supabase/server.ts` | `@supabase/ssr` `createServerClient` | Async cookies; includes `getOrProvisionProfile` helper |
| `src/lib/slack.ts` | Slack Web API (raw `fetch`) | Multi-workspace token routing |
| `src/lib/notifications.ts` | Resend API (raw `fetch`) | Email send helper |
| `src/lib/reminder-logic.ts` | Business logic | Reminder scheduling, message building, quarter/period utilities |

---

*Integration audit: 2026-05-23*
