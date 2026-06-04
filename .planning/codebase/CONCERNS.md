---
last_mapped_commit: 804cf743d1651aa9bd1d761c60c4d1478e38a540
---

# Codebase Concerns

**Analysis Date:** 2026-06-04

## Tech Debt

**Supabase client typed as `any` at every call site:**
- Issue: `createClient()` returns `SupabaseClient<Database>`, but pages and server actions cast to `(supabase as any)` before `.from()` / `.rpc()`. Schema drift surfaces only at runtime.
- Files: `src/lib/actions/*.ts`, `src/app/(protected)/**/*.tsx`, `src/lib/supabase/server.ts`, `src/proxy.ts`, `src/app/auth/callback/route.ts` (~45 files, 200+ cast sites)
- Impact: Broken column renames, missing RLS policies, and RPC signature changes are invisible to `tsc`.
- Fix approach: Regenerate `src/lib/types/database.ts` via `supabase gen types typescript` and remove casts; add a CI check that fails on new `as any` on the Supabase client.

**Hand-maintained `Database` types:**
- Issue: `src/lib/types/database.ts` (~393 lines) is edited manually instead of generated from the live schema.
- Files: `src/lib/types/database.ts`
- Impact: Types lag migrations; contributes to the `as any` workaround culture.
- Fix approach: Generate types in CI after `supabase db push` and commit the artifact.

**Dead edge middleware (`src/proxy.ts`):**
- Issue: Auth redirect, session cookie refresh, and first-check-in gate live in `src/proxy.ts` with export name `proxy`, but Next.js only runs `src/middleware.ts` with a `middleware` export. No `middleware.ts` exists in the repo.
- Files: `src/proxy.ts`, `src/app/(protected)/layout.tsx` (partial substitute)
- Impact: First-check-in gate and centralized unauthenticated redirects never run at the edge; behavior depends on each route calling `getUser()` / layout redirects.
- Fix approach: Rename to `src/middleware.ts` and export `middleware` (or re-export `proxy` as `middleware`).

**Monolithic server pages:**
- Issue: Team dashboard, employee detail, and analytics pages mix data fetching, business rules, and large JSX in single files.
- Files: `src/app/(protected)/team/page.tsx` (~710 lines), `src/app/(protected)/team/[employeeId]/page.tsx` (~599), `src/app/(protected)/dashboard/page.tsx` (~528), `src/app/(protected)/analytics/page.tsx` (~400), `src/components/org/OrgChart.tsx` (~504)
- Impact: Hard to test, review, and change one concern without regressions.
- Fix approach: Extract query helpers under `src/lib/queries/` and presentational subcomponents; keep pages as thin composers.

**OKR workflow bypass:**
- Issue: New goals are inserted with `status: 'APPROVED'` while transition tables, inbox flows, and manager review UI assume DRAFT → PENDING_REVIEW → APPROVED.
- Files: `src/lib/actions/okr-actions.ts` (create path ~line 61), `src/lib/actions/onboarding-actions.ts` (seed goals as APPROVED)
- Impact: Dead code paths, misleading inbox/scoring semantics, and inconsistent product behavior if review is re-enabled later.
- Fix approach: Decide product intent; either default to `DRAFT` and wire submit-for-review, or remove unused transition UI and document manager-less goals.

**Duplicate SQL migrations:**
- Issue: `supabase/migrations/00017_ai_builder_and_values.sql` and `00019_ai_builder_and_values.sql` are near-identical (AI Builder columns + company value seed DELETE/INSERT).
- Files: `supabase/migrations/00017_ai_builder_and_values.sql`, `supabase/migrations/00019_ai_builder_and_values.sql`
- Impact: Fresh database applies destructive `DELETE FROM company_values` twice; confusing history for operators.
- Fix approach: Squash or document one as no-op on replay; avoid duplicate destructive seeds in new environments.

**Environment variable documentation drift:**
- Issue: `.env.example` documents Resend (`RESEND_API_KEY`, `RESEND_FROM`) but runtime email uses Mailtrap HTTP API. `AGENTS.md` still references Resend optional no-op.
- Files: `.env.example`, `src/lib/notifications.ts`, `AGENTS.md`
- Impact: New deploys configure the wrong provider; emails silently no-op when only Resend is set.
- Fix approach: Align `.env.example` and ops docs with `MAILTRAP_API_TOKEN` / `MAILTRAP_FROM`.

**Declared stack vs implementation:**
- Issue: `package.json` includes `zustand` and `nuqs`; no `useSessionStore`, `useUIStore`, or `nuqs` usage exists in `src/`. PROJECT/AGENTS still describe Next.js 15 while the app runs Next 16.2.4.
- Files: `package.json`, `PROJECT.md`, `AGENTS.md`
- Impact: Unused dependencies and misleading onboarding docs.
- Fix approach: Remove unused packages or implement the documented stores; update PROJECT.md to Next 16.

**Period auto-management on every layout load:**
- Issue: `ensureCurrentPeriod()` runs from `src/app/(protected)/layout.tsx` for every authenticated MANAGER/HR_ADMIN request and discards errors from inserts/updates.
- Files: `src/app/(protected)/layout.tsx`, `src/lib/actions/period-actions.ts`
- Impact: Extra DB writes on unrelated page views; silent failure if RLS or constraints block period writes.
- Fix approach: Move to a scheduled Netlify function (service role) or HR-only admin action with explicit error surfacing.

**Demo / cleanup migrations in production history:**
- Issue: Migrations include one-off data fixes and test-data cleanup (`00022_cleanup_demo_data.sql`, `00027_clean_team_test_data.sql`, `00029_import_employees.sql`).
- Files: `supabase/migrations/00022_cleanup_demo_data.sql`, `supabase/migrations/00027_clean_team_test_data.sql`, `supabase/migrations/00029_import_employees.sql`
- Impact: New environment bootstrap runs opinionated seed/cleanup SQL; risk if replayed on wrong database.
- Fix approach: Separate seed scripts from versioned schema migrations; gate data migrations behind explicit ops runbooks.

## Known Bugs

**Open redirect after OAuth:**
- Symptoms: Authenticated users can be sent to external origins via crafted `next` query param (e.g. `//evil.com`).
- Files: `src/app/auth/callback/route.ts` (lines 8, 24, 55)
- Trigger: Complete Google OAuth with `?next=//attacker.example/path`.
- Workaround: None in app; block at reverse proxy if needed.
- Fix: Allow only relative paths: `next.startsWith('/') && !next.startsWith('//') && !next.includes('://')`.

**Auth callback succeeds without profile when RPC fails:**
- Symptoms: User has a valid session but `upsert_profile_on_login` fails (e.g. domain allowed in TS but rejected in SQL); callback logs error and still redirects to `next`. Protected layout then redirects to login in a loop or shows broken state.
- Files: `src/app/auth/callback/route.ts`, `src/lib/auth/allowed-domains.ts`, `supabase/migrations/00018_domain_whitelist.sql`
- Trigger: Sign in with `clovrlabs.com` (in TS whitelist, not in SQL RPC whitelist).
- Workaround: Add domain to SQL function and redeploy migration.
- Fix: On `rpcError`, sign out and redirect to `/login?error=provision`; align domain lists.

**Domain whitelist split-brain:**
- Symptoms: `isAllowedEmail()` passes in callback but `upsert_profile_on_login` raises `Email domain not allowed` for domains present only in TypeScript.
- Files: `src/lib/auth/allowed-domains.ts` (`clovrlabs.com`), `supabase/migrations/00018_domain_whitelist.sql` (no `clovrlabs.com`)
- Trigger: Any `@clovrlabs.com` user completing OAuth.
- Workaround: Patch SQL whitelist to match TS.
- Fix: Single source of truth (DB table or shared config tested in CI).

**Profile fallback insert skips domain check:**
- Symptoms: When RPC fails, `getOrProvisionProfile` inserts into `profiles` without calling `isAllowedEmail()`.
- Files: `src/lib/supabase/server.ts` (fallback block ~lines 61–75)
- Trigger: RPC failure modes other than schema-cache miss (or malicious session if auth boundary fails elsewhere).
- Workaround: Rely on callback domain check (does not cover deep-link provisioning path).
- Fix: Guard fallback with `isAllowedEmail(user.email)`; prefer failing closed.

## Security Considerations

**Reminder HTTP endpoints optional auth:**
- Risk: `netlify/functions/slack-reminders.mts` and `email-reminders.mts` only enforce `REMINDER_SECRET` when the env var is set (`if (reminderSecret && ...)`). If unset, any caller who discovers the function URL can trigger mass Slack DMs / emails.
- Files: `netlify/functions/slack-reminders.mts`, `netlify/functions/email-reminders.mts`
- Current mitigation: Documented as optional in `.env.example`; Slack path filters `role = 'EMPLOYEE'`.
- Recommendations: Require `REMINDER_SECRET` in production (fail closed if missing); restrict invokers to Netlify scheduled triggers only.

**Service role in scheduled functions:**
- Risk: `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS for reminder batch jobs and any future admin automation.
- Files: `netlify/functions/slack-reminders.mts`, `netlify/functions/email-reminders.mts`
- Current mitigation: Functions only read profiles/check-in status and send notifications; not exposed to browsers.
- Recommendations: Scope service role to minimal RPCs; audit function logs; rotate key on compromise.

**OpenAI historical review extraction:**
- Risk: Manager-pasted text is sent to OpenAI; model output is `JSON.parse`d without schema validation. Prompt injection could skew extracted scores or summary; PII leaves BCOMM infra.
- Files: `src/lib/actions/historical-review-actions.ts`
- Current mitigation: Requires `OPENAI_API_KEY`; server action checks authentication before save (separate from extract).
- Recommendations: Zod-validate extracted JSON; truncate/sanitize input; document data-processing policy for HR.

**LLM and Slack tokens in environment:**
- Risk: `OPENAI_API_KEY`, `SLACK_WORKSPACE_TOKENS` (JSON domain → token map) are high-value secrets in Netlify env.
- Files: `.env.example`, `src/lib/slack.ts`, `netlify/functions/slack-reminders.mts`
- Recommendations: Netlify secret scanning, least-privilege Slack bot scopes, no tokens in logs.

**Guide content XSS surface (mitigated):**
- Risk: HR-editable markdown rendered as HTML.
- Files: `src/app/(protected)/guide/page.tsx` (`dangerouslySetInnerHTML` after `sanitize-html`)
- Current mitigation: `marked` + `sanitize-html` with restricted tags/schemes.
- Recommendations: Keep admin-only write access; re-audit allowed tags when upgrading `sanitize-html`.

**Email HTML injection (largely mitigated):**
- Risk: User-supplied names/titles in notification templates.
- Files: `src/lib/notifications.ts` (`esc()` used on dynamic fields in OKR/check-in templates)
- Current mitigation: `esc()` helper on interpolated user strings.
- Recommendations: Audit any new templates for unescaped interpolation; add regression test for `esc()`.

**RLS role escalation (mitigated in DB):**
- Risk: Users updating their own `role` to `HR_ADMIN` via PostgREST.
- Files: `supabase/migrations/00025_security_fixes.sql` (policy fix), originally `00001_foundation.sql`
- Current mitigation: `profiles_self_update_meta` WITH CHECK preserves existing role.
- Recommendations: Verify policy on production; add integration test against direct REST PATCH.

## Performance Bottlenecks

**Heavy team page per request:**
- Problem: `src/app/(protected)/team/page.tsx` issues many sequential Supabase queries (subordinates, check-ins, scores, OKRs, quarterly status) in one RSC render.
- Files: `src/app/(protected)/team/page.tsx`
- Cause: Inline orchestration without parallel `Promise.all` or consolidated RPC.
- Improvement path: Add `get_manager_team_dashboard` RPC returning one JSON payload; cache per-request subtrees where safe.

**Analytics page multi-RPC fan-out:**
- Problem: `src/app/(protected)/analytics/page.tsx` loads several chart datasets with separate queries.
- Files: `src/app/(protected)/analytics/page.tsx`
- Cause: Independent fetches per chart section.
- Improvement path: Parallelize fetches; consider materialized views for org-wide aggregates.

**Manager layout inbox count:**
- Problem: Every protected navigation for managers/HR runs `get_subordinates` + `get_pending_okr_count` in layout.
- Files: `src/app/(protected)/layout.tsx`
- Cause: Badge count computed on all routes, not only inbox.
- Improvement path: Lazy-load badge via client fetch or cache with short TTL.

**Org chart client bundle:**
- Problem: `src/components/org/OrgChart.tsx` (~504 lines) with interactive layout loads for `/org` and admin org views.
- Files: `src/components/org/OrgChart.tsx`, `src/app/(protected)/org/page.tsx`, `src/app/(protected)/admin/org/page.tsx`
- Improvement path: `dynamic()` import with loading skeleton; simplify graph for large hierarchies.

## Fragile Areas

**Org closure rebuild after manager change:**
- Files: `src/lib/actions/user-actions.ts` (`assignManager`), `supabase/migrations/00010_org_structure.sql` (`rebuild_closure_for_employee`)
- Why fragile: Profile `manager_id` updates before RPC; RPC failure leaves manager updated but stale `org_closure` (explicit error returned, manual repair needed).
- Safe modification: Run assign + rebuild in a single DB transaction via RPC; add admin repair tool.
- Test coverage: None automated.

**Quarterly check-in → OKR sync:**
- Files: `src/lib/actions/quarterly-checkin-actions.ts` (`syncNextQuarterGoalsToOkrs`)
- Why fragile: Soft-deletes and upserts OKRs per goal id; depends on `performance_periods` existing for next quarter (created by `ensureCurrentPeriod`).
- Safe modification: Add tests for delete/sync edge cases; ensure next period exists before submit.
- Test coverage: None.

**MIT auto-carry between monthly check-ins:**
- Files: `src/lib/actions/checkin-actions.ts` (carry on submit, `.catch` on failure)
- Why fragile: Fire-and-forget carry; failure only logged, employee may lose MIT continuity.
- Safe modification: Await carry; surface retry in UI on failure.

**Check-in submit race on first insert:**
- Files: `src/lib/actions/checkin-actions.ts`, `src/lib/actions/quarterly-checkin-actions.ts`
- Why fragile: Update path uses conditional `.is('employee_submitted_at', null)`; concurrent first-time inserts can race until UNIQUE constraint (`00002_core_features.sql`) returns `23505` (handled for quarterly, verify monthly UX).
- Safe modification: Use upsert with conflict target or single transactional RPC for submit.

**Theme hydration:**
- Files: `src/components/theme/ThemeProvider.tsx`
- Why fragile: ESLint flags synchronous `setState` in `useEffect` (react-hooks/set-state-in-effect); possible flash or double render.
- Safe modification: Initialize theme from cookie/script tag per Next.js + LR design patterns.

## Scaling Limits

**Supabase RLS + closure table:**
- Current capacity: Org hierarchy queries use `org_closure` materialized paths; suitable for hundreds of employees per manager subtree.
- Limit: Deep reorgs trigger `rebuild_closure_for_employee` cost; very large subtrees slow admin reassignment.
- Scaling path: Batch closure rebuilds; background job for mass imports (`00029_import_employees.sql` pattern should not run in request path).

**Netlify serverless reminders:**
- Current capacity: Daily cron invokes functions that iterate all EMPLOYEE profiles sequentially (Slack lookup + DM per user).
- Limit: Timeouts and rate limits as headcount grows; no queue/backpressure beyond `00031_reminder_log.sql` dedup.
- Scaling path: Chunk employees; queue with retry; move to Supabase Edge Function or worker with higher timeout.

**Single-region hosted Supabase:**
- Current capacity: One remote Postgres project (no local Docker in repo).
- Limit: All environments share dependency on Supabase availability and connection pooler (`SUPABASE_POOLER` for migrations).
- Scaling path: Read replicas only via Supabase plan; app remains single Next deployment on Netlify.

## Dependencies at Risk

**Next.js 16 / React 19:**
- Risk: Fast-moving App Router and React Compiler rules; eslint-plugin-react-hooks stricter (already failing in `ThemeProvider.tsx`).
- Impact: Build/lint CI noise; subtle RSC boundary bugs.
- Migration plan: Pin versions in lockfile; run codemods on major upgrades; fix hook lint before enabling stricter CI.

**Supabase SSR package (`@supabase/ssr@0.10.2`):**
- Risk: Auth cookie patterns are easy to miswire; project comment references middleware refresh but middleware is absent.
- Impact: Stale sessions or failed cookie refresh on edge.
- Migration plan: Implement official middleware template; test magic link + OAuth flows.

**OpenAI SDK (`openai@^6.39.0`):**
- Risk: Model deprecation (`gpt-4o-mini`), API key exposure in serverless logs.
- Impact: Historical import feature breaks silently when key missing (returns error string).
- Migration plan: Abstract provider; version model in config.

## Missing Critical Features

**Data retention policy:**
- Problem: PROJECT.md requires retention policy for long-term operational data; no documented retention, purge jobs, or export/delete runbook in repo.
- Blocks: Compliance sign-off for HR performance data (check-ins, scores, kudos, mood).

**Automated test suite beyond reminders:**
- Problem: Only `src/lib/__tests__/reminder-logic.test.ts` (~334 lines) runs via `npm test`; no component, server action, or RLS integration tests.
- Blocks: Safe refactors of check-in v2, scoring, and auth flows.

**Operational monitoring:**
- Problem: No Sentry/Datadog or structured logging contract; failures use `console.error` in actions and pages.
- Blocks: Proactive detection of silent notification drops and RPC failures.

## Test Coverage Gaps

**Server actions (check-ins, scoring, OKRs):**
- What's not tested: Submit guards, conditional update races, carry MIT, quarterly OKR sync, performance score persistence.
- Files: `src/lib/actions/checkin-actions.ts`, `src/lib/actions/quarterly-checkin-actions.ts`, `src/lib/actions/performance-actions.ts`, `src/lib/actions/okr-actions.ts`
- Risk: Regressions in core product flows; prior review found silent success bugs (many fixed, not regression-locked).
- Priority: High

**Auth and provisioning:**
- What's not tested: Domain whitelist parity TS/SQL, callback redirect validation, `getOrProvisionProfile` fallback.
- Files: `src/app/auth/callback/route.ts`, `src/lib/supabase/server.ts`, `src/lib/auth/allowed-domains.ts`
- Risk: Login loops and unauthorized profile creation.
- Priority: High

**RLS policies:**
- What's not tested: Direct PostgREST access patterns for `profiles`, `quarterly_scores`, `get_subordinates`.
- Files: `supabase/migrations/00001_foundation.sql`, `00025_security_fixes.sql`
- Risk: Data leaks between employees/managers.
- Priority: High

**Netlify reminder functions:**
- What's not tested: Secret enforcement, idempotency via `reminder_log`, role filtering.
- Files: `netlify/functions/slack-reminders.mts`, `netlify/functions/email-reminders.mts`, `supabase/migrations/00031_reminder_log.sql`
- Risk: Accidental spam or unauthenticated invocation.
- Priority: Medium

**UI forms (check-in v2):**
- What's not tested: MIT list state, tab auto-save, goal link dropdown behavior (plain `useState`, not RHF).
- Files: `src/components/checkins/EmployeeCheckinForm.tsx`, `src/components/checkins/QuarterlyCheckinEmployeeForm.tsx`, `src/components/checkins/MitPlanList.tsx`
- Risk: UX regressions on long forms.
- Priority: Medium

---

*Concerns audit: 2026-06-04*
