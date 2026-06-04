---
last_mapped_commit: 804cf743d1651aa9bd1d761c60c4d1478e38a540
---

# External Integrations

**Analysis Date:** 2026-06-04

## APIs & External Services

**Supabase (primary backend):**
- **PostgreSQL** — all structured data (profiles, org hierarchy, check-ins, OKRs, scores, kudos, guide, reminders log)
- **Auth** — magic-link OTP (login UI) and optional Google OAuth helper (`src/components/auth/SignInButton.tsx` — not used on `src/app/login/page.tsx`)
- **Storage** — public `avatars` bucket; upload in `src/components/profile/ProfileSettingsForm.tsx`
- **PostgREST + RPC** — app queries tables and functions (`get_subordinates`, `upsert_profile_on_login`, `invite_team_member`, etc.) from pages and `src/lib/actions/*.ts`
- SDK: `@supabase/supabase-js`, SSR wrapper `@supabase/ssr`
- Auth env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Elevated access: `SUPABASE_SERVICE_ROLE_KEY` (Netlify scheduled functions only)

**Mailtrap (transactional email — production path):**
- REST API: `https://send.api.mailtrap.io/api/send`
- Implementation: `src/lib/notifications.ts` (`sendEmail`, invite/check-in/kudos templates)
- Also required by: `netlify/functions/email-reminders.mts`
- Auth: `MAILTRAP_API_TOKEN` (Bearer)
- From address: `MAILTRAP_FROM` (default `noreply@lunarrails.io` in code)
- Behavior: no-ops when token missing (dev-safe); production cron returns 500 if missing

**Resend (documented, not wired in app code):**
- Package `resend` in `package.json` — **no imports under `src/` or `netlify/`**
- `.env.example` lists `RESEND_API_KEY`, `RESEND_FROM` — stale relative to Mailtrap implementation
- Treat Mailtrap as the live email provider unless Resend is reconnected

**Slack (check-in reminder DMs):**
- REST API base: `https://slack.com/api` — `src/lib/slack.ts`
- Methods used: `users.lookupByEmail`, `conversations.open`, `chat.postMessage` (Block Kit)
- Multi-workspace: domain → bot token map from `SLACK_WORKSPACE_TOKENS` JSON; parsing in `src/lib/reminder-logic.ts` (`parseWorkspaceTokens`, `getTokenForEmail`)
- Scheduled sender: `netlify/functions/slack-reminders.mts`
- Setup doc: `docs/slack-reminders-setup.md`
- Required bot scopes: `users:read.email`, `im:write`, `chat:write`

**OpenAI (optional LLM extraction):**
- SDK: `openai` package
- Server Action: `extractReviewWithLLM` in `src/lib/actions/historical-review-actions.ts`
- Model: `gpt-4o-mini` (structured JSON from pasted review notes)
- Auth: `OPENAI_API_KEY` — returns user-facing error if unset

**Google (client-side only, no server API key):**
- **Fonts** — `next/font/google` in `src/app/layout.tsx` (Space Grotesk, Inter)
- **Calendar deep links** — `src/components/checkins/ScheduleCallButton.tsx` opens `calendar.google.com` (no Google Calendar API integration)
- **OAuth** — Supabase Auth provider `google` in `src/components/auth/SignInButton.tsx`; login page uses OTP via `src/components/auth/MagicLinkForm.tsx` instead

## Data Storage

**Databases:**
- **Supabase PostgreSQL 17** (managed)
  - Schema: `supabase/migrations/` (00001–00031+)
  - Connection for CI/deploy migrations: `SUPABASE_POOLER` (Postgres URI, session/pooler mode)
  - Client: Supabase JS with RLS enforced for browser/server user sessions (`auth.uid()`)
  - Types: hand-maintained `src/lib/types/database.ts` (not auto-generated in repo)

**File Storage:**
- **Supabase Storage** — `avatars` public bucket
  - Policies: `supabase/migrations/00026_avatar_storage_and_notification_prefs.sql`
  - Client uploads: `src/components/profile/ProfileSettingsForm.tsx` (`supabase.storage.from('avatars').upload`)

**Caching:**
- None (no Redis, no edge KV). Next.js `revalidatePath` used after Server Action mutations.

## Authentication & Identity

**Auth Provider:**
- **Supabase Auth** (hosted)
  - Primary login: email **magic link OTP** — `supabase.auth.signInWithOtp` in `src/components/auth/MagicLinkForm.tsx` and `src/components/auth/ResendMagicLinkButton.tsx`
  - Callback: `src/app/auth/callback/route.ts` — `exchangeCodeForSession`, domain check, `upsert_profile_on_login` RPC
  - Domain allowlist: `src/lib/auth/allowed-domains.ts` (also enforced in callback route)
  - DB whitelist migration: `supabase/migrations/00018_domain_whitelist.sql`
  - Session reads: always `getUser()` (not `getSession()`) per `src/proxy.ts` comments and protected layouts

**Authorization:**
- **RLS** on Postgres tables (migrations e.g. `00025_security_fixes.sql`)
- **Application roles** — `user_role` enum: `EMPLOYEE`, `MANAGER`, `HR_ADMIN` (`supabase/migrations/00001_foundation.sql`)
- **Layout gates** — `src/app/(protected)/layout.tsx`, `src/app/(protected)/admin/layout.tsx`

**Service role usage (bypasses RLS):**
- `netlify/functions/email-reminders.mts`
- `netlify/functions/slack-reminders.mts`
- Not used in `src/lib/actions/` for normal user flows (invites use RPC with user JWT)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc.)

**Logs:**
- `console.log` / `console.error` in notifications (`src/lib/notifications.ts`), Slack helper (`src/lib/slack.ts`), Netlify functions, and Server Actions
- Netlify function execution logs for scheduled reminders

## CI/CD & Deployment

**Hosting:**
- **Netlify** — `netlify.toml`
  - Build: `npm run build:deploy` → `scripts/netlify-build.sh` (optional `supabase db push` then `next build`)
  - Publish: `.next`
  - Plugin: `@netlify/plugin-nextjs`

**CI Pipeline:**
- Not detected (no `.github/workflows/` or similar in repo)

**Database migrations on deploy:**
- `scripts/netlify-build.sh` runs `npx supabase db push --db-url "$SUPABASE_POOLER"` when `SUPABASE_POOLER` is set
- Local/manual: `npm run supabase:push` (sources `.env.local` in npm script — do not commit secrets)

## Environment Configuration

**Required env vars (runtime app):**
| Variable | Used in |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase/client.ts`, `server.ts`, `src/proxy.ts`, Netlify functions |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same |
| `NEXT_PUBLIC_APP_URL` | `src/app/layout.tsx` metadata, notifications, Slack reminder links |

**Required for production build (migrations):**
| Variable | Used in |
|----------|---------|
| `SUPABASE_POOLER` | `scripts/netlify-build.sh` |

**Required for scheduled reminders (Netlify Functions):**
| Variable | Used in |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | `netlify/functions/email-reminders.mts`, `slack-reminders.mts` |
| `MAILTRAP_API_TOKEN` | `email-reminders.mts` (hard fail if missing in cron) |
| `SLACK_WORKSPACE_TOKENS` | `slack-reminders.mts` (warn + skip sends if empty) |
| `NEXT_PUBLIC_APP_URL` | Reminder deep links in `src/lib/reminder-logic.ts` / Slack blocks |

**Optional / feature flags:**
| Variable | Purpose |
|----------|---------|
| `MAILTRAP_FROM` | Sender email override |
| `REMINDER_SECRET` | `x-reminder-secret` header check on cron HTTP invocations |
| `REMINDER_DATE_OVERRIDE` | Test override for “today” in reminder logic |
| `OPENAI_API_KEY` | Historical review AI extract |
| `NEXT_PUBLIC_SITE_URL` | Calendar invite descriptions on check-in pages |
| `RESEND_API_KEY` / `RESEND_FROM` | Documented in `.env.example` only — not used by current code |

**Secrets location:**
- Local: `.env.local` (gitignored)
- Production: Netlify environment variables (Site configuration); Supabase dashboard for DB/API keys
- Template reference: `.env.example` (no secret values)

## Webhooks & Callbacks

**Incoming:**
- **Supabase Auth OAuth/magic-link callback** — `GET src/app/auth/callback/route.ts` (`?code=`, `?next=`)
- **Onboarding reset** — `GET src/app/onboarding/reset/route.ts` (clears `pending_manager_id`, redirects)
- **Netlify scheduled function HTTP** — `email-reminders`, `slack-reminders` (cron `0 9 * * *` UTC per `netlify.toml`); optional `REMINDER_SECRET` header auth
- No Stripe, GitHub, or generic webhook routes

**Outgoing:**
- Mailtrap send API (email notifications and cron reminders)
- Slack Web API (DM reminders)
- OpenAI Chat Completions API (on-demand from Server Action)
- Supabase REST/RPC/Storage (all app reads/writes)
- Google Calendar **URL** only (user browser opens new tab — not a server callback)

## Integration Data Flow (reminders)

```text
Netlify Cron (09:00 UTC)
    │
    ├─► email-reminders.mts
    │       ├─► Supabase (service role) — profiles, check-in status
    │       └─► Mailtrap API — employee emails
    │
    └─► slack-reminders.mts
            ├─► Supabase (service role) — profiles
            └─► Slack API — per-domain bot token DM
```

Shared logic: `src/lib/reminder-logic.ts` (window dates, message blocks, token map).

## Integration Notes for Implementers

- **Align `.env.example` with Mailtrap** — production code paths use `MAILTRAP_*`, not Resend.
- **Do not add API routes for domain logic** — extend `src/lib/actions/` and Supabase RPC/migrations instead.
- **New email provider** — replace `sendEmail` in `src/lib/notifications.ts` and update `netlify/functions/email-reminders.mts` guard/env checks together.
- **New Slack workspace** — add domain → `xoxb-` token entry in `SLACK_WORKSPACE_TOKENS` and install the CiaoBob app in that workspace (`docs/slack-reminders-setup.md`).

---

*Integration audit: 2026-06-04*
