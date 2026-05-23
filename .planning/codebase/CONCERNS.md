# Codebase Concerns

**Analysis Date:** 2026-05-23

---

## Security Concerns

### [Critical] Missing Next.js Middleware — Auth Guard Is Partially Bypassed

`src/proxy.ts` exports a `proxy` function and a route `config`, but **there is no `src/middleware.ts` file**. In Next.js the middleware entry point must be named `middleware.ts` at `src/` or the repo root. The current file is never invoked by the Next.js runtime.

- Files: `src/proxy.ts` (dead code as middleware)
- Impact: Auth redirect logic in `proxy.ts` never runs server-side. The `(protected)` layout does redirect unauthenticated users, but middleware is the correct defense-in-depth layer for this. Caching or edge-case route access could slip through before the layout redirect fires.
- Fix: Rename `src/proxy.ts` to `src/middleware.ts` and verify the matcher covers all protected paths.

---

### [Critical] `profiles_self_update_meta` RLS Policy Allows Role Self-Escalation

The RLS policy on `profiles` (`profiles_self_update_meta`) allows any authenticated user to `UPDATE` their own row with no `WITH CHECK` constraint on individual columns:

```sql
CREATE POLICY profiles_self_update_meta
  ON profiles FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
```

- Files: `supabase/migrations/00001_foundation.sql` (line 241–244)
- Impact: A user who can issue Supabase client calls directly (e.g. via the anon key in the browser) could set their own `role` to `HR_ADMIN`. The application Server Actions do not write role via the user's own session so the practical exploit path is a direct PostgREST call using their session JWT.
- Fix: Restrict the WITH CHECK to only the columns a user may legitimately update (e.g. `full_name`, `avatar_url`). Move role updates to a security-definer function callable only by HR_ADMIN, or add a column-level check: `WITH CHECK (id = auth.uid() AND role = OLD.role)`.

---

### [Warning] Unescaped User Content in HTML Email Templates

Email templates in `src/lib/notifications.ts` interpolate user-controlled strings directly into raw HTML without escaping:

```typescript
// Line 152 — okrTitle is an employee-submitted string
${okrTitle}

// Line 155 — manager comment is user input
${comment ? `<p><strong>Manager note:</strong> ${comment}</p>` : ''}
```

- Files: `src/lib/notifications.ts` (lines 140–156)
- Impact: An employee who sets an OKR title like `</blockquote><script>alert(1)</script>` could inject HTML into the notification email delivered to their manager. Email clients vary in how they handle embedded HTML/scripts — the risk is HTML injection in email (phishing-quality content, link substitution), not DOM XSS.
- Fix: HTML-escape all user-supplied strings before interpolation. Use a helper like:
  ```typescript
  const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  ```
  Apply to `okrTitle`, `comment`, `employeeName`, `managerName`, etc.

---

### [Warning] Domain Whitelist Maintained in Two Places — Drift Risk

Allowed email domains are duplicated between application code and the database migration:

- `src/lib/auth/allowed-domains.ts` — checked in the OAuth callback route
- `supabase/migrations/00018_domain_whitelist.sql` — enforced in `upsert_profile_on_login` PLPGSQL function

These must be kept in sync manually. A new domain added only to the TypeScript file would be accepted by the callback but rejected by the DB RPC (causing a silent login failure). The reverse exposes data.

- Files: `src/lib/auth/allowed-domains.ts`, `supabase/migrations/00018_domain_whitelist.sql`
- Fix: Make one authoritative. The DB-level guard is stronger; consider having the TS file query the DB for the list, or add a test that asserts both sets are identical.

---

### [Warning] Netlify Slack Reminder Function Has No Request Authentication

`netlify/functions/slack-reminders.mts` is a scheduled function but its HTTP handler accepts any `GET` request with no bearer token or secret validation. If triggered via its direct URL it would broadcast Slack reminders to all users.

- Files: `netlify/functions/slack-reminders.mts` (line 22 — `handler()` has no auth check)
- Impact: Low on Netlify scheduled functions (they are not publicly routable by default), but the lack of defense-in-depth means any future change in routing or testing could trigger mass Slack DMs.
- Fix: Add a shared secret check: `if (request.headers.get('x-reminder-secret') !== process.env.REMINDER_SECRET) return new Response('Forbidden', { status: 403 })`.

---

### [Info] Service Role Key Falls Back to Anon Key for User Deletion

In `removeUser`, if `SUPABASE_SERVICE_ROLE_KEY` is absent, the action silently falls back to deleting only the `profiles` row (not the `auth.users` entry). The user can re-authenticate and recreate their profile.

- Files: `src/lib/actions/admin-actions.ts` (lines 31–38)
- Impact: HR Admin "removal" of a user in environments without the service role key configured is incomplete — the user retains valid Google OAuth credentials and can re-enter the app on next login.
- Fix: Either make `SUPABASE_SERVICE_ROLE_KEY` required and error hard when missing, or document the fallback behaviour clearly in the admin UI.

---

## Data Integrity Concerns

### [Warning] Several DB Writes Discard Errors Silently

Multiple `update` calls in Server Actions do not destructure `{ error }` and have no error path:

```typescript
// checkin-actions.ts line 118 — update return value ignored
await (supabase as any).from('checkins').update(payload).eq('id', existing.id)

// performance-actions.ts line 131 — update return value ignored
await (supabase as any).from('quarterly_scores').update(payload).eq('id', existing.id)

// performance-actions.ts line 265 — update return value ignored
await (supabase as any).from('annual_scores').update(payload).eq('id', existing.id)

// okr-actions.ts line 137, 145, 189, 239 — multiple updates ignore errors
```

- Files: `src/lib/actions/checkin-actions.ts` (line 118), `src/lib/actions/performance-actions.ts` (lines 131, 265), `src/lib/actions/okr-actions.ts` (lines 137, 145, 189, 239)
- Impact: A failed update (RLS violation, constraint error, network hiccup) returns `{ success: true }` to the caller. Users receive false confirmation that data was saved.
- Fix: Destructure `{ error }` from every mutation and return an error result on failure.

---

### [Warning] `deleteQuarterlyCheckin` Does Not Check Submitted Status

`deleteQuarterlyCheckin` in `src/lib/actions/quarterly-checkin-actions.ts` allows an employee to delete any of their own quarterly check-ins, including submitted ones. The monthly checkin action explicitly guards `if (existing?.employee_submitted_at) return { error: '...' }` but the quarterly equivalent has no such guard.

- Files: `src/lib/actions/quarterly-checkin-actions.ts` (lines 234–255)
- Impact: An employee can delete a quarterly check-in after submission, which removes the manager's visibility into the completed quarter. The `DeleteQuarterlyCheckinButton` component exists and is surfaced in the UI.
- Fix: Add `const existing = await ... .select('employee_submitted_at')...` and guard: `if (existing?.employee_submitted_at) return { error: 'Cannot delete a submitted check-in' }`.

---

### [Warning] OKR Creation Uses Sequential Inserts Without a Transaction

`createOkr` inserts one key result at a time in a `for` loop. If a key-result insert fails midway, a cleanup `delete` on the parent OKR is attempted, but initiative inserts that already succeeded are not cleaned up, and the OKR row may survive if the cleanup itself fails silently.

- Files: `src/lib/actions/okr-actions.ts` (lines 70–100)
- Impact: Partial OKR objects (objective row exists, some KRs missing) can accumulate in the DB without the user knowing.
- Fix: Wrap the OKR + KR + initiative creation in a Supabase `rpc` call (PLPGSQL function inside a `BEGIN … COMMIT` block) so the operation is atomic, or use the Supabase JS client's `insert … returning` with a single batch insert for KRs and initiatives.

---

### [Warning] `upsert_profile_on_login` Overwrites `full_name` and `avatar_url` on Every Login

The migration-18 version of `upsert_profile_on_login` always updates `full_name` and `avatar_url` from the OAuth provider on re-login:

```sql
ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
```

- Files: `supabase/migrations/00018_domain_whitelist.sql`
- Impact: If a user has manually changed their display name inside the app and then re-logs in via Google (whose display name differs), their name silently reverts to the Google profile name. An HR admin who renamed a user in the `profiles` table will lose that change.
- Fix: Only update `full_name`/`avatar_url` when the current values are `NULL`, or expose a separate "sync from provider" flag.

---

### [Warning] Duplicate Migration Number `00019`

Two migration files share the same number prefix:
- `supabase/migrations/00019_ai_builder_and_values.sql`
- `supabase/migrations/00019_mood_tracking.sql`

- Files: `supabase/migrations/00019_ai_builder_and_values.sql`, `supabase/migrations/00019_mood_tracking.sql`
- Impact: Supabase CLI applies migrations in lexicographic order. Both files will be applied, but the ordering between them is non-deterministic across different sort implementations. If they have inter-dependencies (one creates a column the other references) the order matters. The Supabase CLI may also reject the second file if it expects unique version numbers.
- Fix: Renumber one file to `00019` and the other to `00020`, and cascade-increment subsequent migrations.

---

## Code Quality Concerns

### [Warning] Pervasive `(supabase as any)` Type Escape

The generated `Database` type is imported in `src/lib/supabase/server.ts` and `src/lib/supabase/client.ts` via `createServerClient<Database>` and `createBrowserClient<Database>`, but the typed client is immediately cast to `any` at every call site across the codebase. This defeats the purpose of the generated types entirely.

Affected files (non-exhaustive):
- `src/lib/actions/checkin-actions.ts` — 8 instances
- `src/lib/actions/performance-actions.ts` — 10 instances
- `src/lib/actions/okr-actions.ts` — 12 instances
- `src/lib/actions/quarterly-checkin-actions.ts` — 10 instances
- `src/lib/actions/admin-actions.ts` — 6 instances
- `src/lib/supabase/server.ts` — 3 instances
- `src/app/(protected)/dashboard/page.tsx` — 8 instances
- Nearly every page under `src/app/(protected)/`

Total: ~80+ `(supabase as any)` casts across the codebase.

- Impact: No compile-time validation of table names, column names, or return types. Schema changes will produce runtime errors that TypeScript cannot catch. Refactoring is unsafe.
- Fix: Re-run `supabase gen types typescript` to regenerate `src/lib/types/database.ts` from the current schema, ensure it includes all tables (especially those added in later migrations), and remove the `as any` casts. The `Database` type is already threaded through `createServerClient<Database>` — the casts suggest the generated types are stale or incomplete.

---

### [Warning] `deleteOkr` Allows Deleting an Approved OKR

`deleteOkr` in `src/lib/actions/okr-actions.ts` only checks employee ownership but not OKR status. An employee can soft-delete an `APPROVED` OKR that a manager has already reviewed and approved.

- Files: `src/lib/actions/okr-actions.ts` (lines 175–193)
- Impact: Approved goals can disappear from the manager's team view after approval, undermining the integrity of the review workflow. The `updateOkr` function correctly guards `if (okr.status !== 'DRAFT' && okr.status !== 'REVISION_REQUESTED')` but `deleteOkr` has no such check.
- Fix: Add `if (okr.status === 'APPROVED' || okr.status === 'PENDING_REVIEW') return { error: 'Cannot delete an OKR in review or approved state' }`.

---

### [Warning] Large God Pages — Dashboard and Team Pages

Several Server Component pages contain extensive data-fetching, business logic, and all rendering in a single file:

- `src/app/(protected)/dashboard/page.tsx` — 487 lines, 12+ parallel Supabase queries, conditional rendering for 3 roles
- `src/app/(protected)/team/page.tsx` — 424 lines
- `src/app/(protected)/team/[employeeId]/page.tsx` — 475 lines
- `src/app/(protected)/analytics/page.tsx` — 392 lines
- `src/app/(protected)/admin/scores/calibration/page.tsx` — 370 lines

- Impact: Difficult to test, maintain, or extend. Business logic (role checks, data aggregation) is mixed with JSX. Streaming/Suspense optimizations are impossible without decomposition.
- Fix: Extract data-fetching into query helper functions in `src/lib/queries/`, and split UI into focused sub-components in `src/components/`.

---

### [Info] `approveTeamRequest` and `declineTeamRequest` Have No Role Guard in Application Code

`src/lib/actions/onboarding-actions.ts` — `approveTeamRequest` and `declineTeamRequest` call RPCs without verifying the caller is a MANAGER or HR_ADMIN at the application layer. Authorization relies entirely on the database-level RPC function behavior.

- Files: `src/lib/actions/onboarding-actions.ts` (lines 44–67)
- Impact: Low — RLS/RPC enforces the rule in the DB. But the pattern is inconsistent with every other action in the codebase, which performs an explicit role check before any DB call. A future refactor that moves logic could silently remove the only guard.
- Fix: Add an explicit caller role check before the RPC calls, consistent with `verifyHRAdmin` in `admin-actions.ts`.

---

### [Info] `okr-actions.ts` Creates All OKRs with Status `APPROVED` Directly

In `createOkr`, new OKRs are inserted with `status: 'APPROVED'` bypassing the DRAFT → PENDING_REVIEW → APPROVED workflow:

```typescript
// okr-actions.ts line 56–62
.insert({
  status: 'APPROVED',  // skips review workflow
})
```

- Files: `src/lib/actions/okr-actions.ts` (line 60)
- Impact: The review workflow (`DRAFT` → `PENDING_REVIEW` → manager review) exists in the codebase (the `transitionOkrStatus` action and `TRANSITIONS` map) but is bypassed for new OKRs. Depending on product intent this may be intentional, but it means managers never review new goals before they become active.
- Fix: Clarify intent. If the bypass is intentional, remove the `DRAFT`/`PENDING_REVIEW` UI state machinery to reduce confusion. If review should be enforced, change the insert to `status: 'DRAFT'`.

---

## Performance Concerns

### [Warning] N+1 Inserts for OKR Key Results and Initiatives

`createOkr` and `updateOkr` each execute one `INSERT` per key result and one `INSERT` per initiative in sequential `for` loops. An OKR with 3 key results and 3 initiatives each would execute 9 sequential round-trips to Supabase.

- Files: `src/lib/actions/okr-actions.ts` (lines 70–100 for create, 147–168 for update)
- Impact: Latency proportional to KR count. `updateOkr` additionally does a bulk `DELETE` first then re-inserts, so every save operation is O(KRs + initiatives) round-trips.
- Fix: Batch KR inserts with a single `.insert([...array])`. Initiatives for a given KR can also be batched. The RPC approach (atomic, one round-trip) is the ideal fix.

---

### [Warning] `force-dynamic` on All Protected Pages Prevents Any Caching

Every page under `src/app/(protected)/` exports `export const dynamic = 'force-dynamic'`. This is correct for session-dependent pages, but means zero static or ISR caching even for pages like `/guide` which renders mostly static admin-authored content.

- Files: All files under `src/app/(protected)/` with `export const dynamic = 'force-dynamic'`
- Impact: Cold load on Netlify Edge / Next.js serverless causes fresh DB queries on every single page navigation. On a team of 50 employees all logging in at period-end, this results in high query concurrency against Supabase.
- Fix: For data that doesn't change per-user request (guide content, company values, performance periods), consider `unstable_cache` or segment-level `revalidate` tagging rather than blanket `force-dynamic`.

---

### [Info] Dashboard Fetches All Quarterly Check-in History to Compute Value Usage

`src/app/(protected)/dashboard/page.tsx` (line 200–211) fetches **all** `quarterly_checkins` rows for the current user to compute a `valueUsage` frequency map client-side:

```typescript
const { data: myQCheckinsRaw } = await (supabase as any)
  .from('quarterly_checkins').select('value_assessments, value_self_assessments').eq('employee_id', user.id)
```

- Files: `src/app/(protected)/dashboard/page.tsx` (lines 200–211)
- Impact: Currently low (employees have at most ~8 quarterly check-ins per 2 years), but grows unboundedly. The aggregation should move to a DB-level query or `rpc()`.
- Fix: Add a Supabase RPC that returns pre-aggregated value usage counts, or add an annual limit on the query (e.g. `.gte('created_at', twoYearsAgo)`).

---

## Operational Concerns

### [Warning] No Startup Environment Variable Validation

There is no `src/env.ts` or equivalent that validates required environment variables at build or startup time. All env vars are accessed inline with `!` non-null assertions or silent fallbacks:

```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL!   // throws at runtime if missing
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!  // throws at runtime if missing
process.env.RESEND_API_KEY              // silently no-ops if missing
process.env.SUPABASE_SERVICE_ROLE_KEY   // silently degrades if missing
```

- Files: `src/lib/supabase/server.ts` (lines 10–11), `src/lib/supabase/client.ts` (lines 6–7), `src/lib/notifications.ts` (line 10), `src/lib/actions/admin-actions.ts` (line 31)
- Impact: A misconfigured deployment (missing `NEXT_PUBLIC_SUPABASE_URL`) fails at runtime on the first request rather than at build/start time. Degraded behaviors (no email, no full user deletion) are silent.
- Fix: Add a Zod-validated `src/lib/env.ts` that parses `process.env` at module load time and throws a descriptive error on startup if any required variable is absent. Use the T3 `t3-env` pattern or a simple Zod `z.object({...}).parse(process.env)`.

---

### [Warning] No Error Monitoring Integration

There is no Sentry, Datadog, or equivalent error reporting integration. Errors in Server Actions and Server Components are only logged to `console.error`.

- Files: All Server Actions (`src/lib/actions/*.ts`), `src/lib/notifications.ts`, `src/lib/supabase/server.ts`
- Impact: Production errors (failed DB writes, email send failures, RPC errors) are invisible unless Netlify/Vercel function logs are actively monitored. The silent-success pattern in several update calls (see Data Integrity section) compounds this — no error fires even when a write fails.
- Fix: Add Sentry or equivalent. At minimum, wrap Server Action error returns in a structured logger that includes user context.

---

### [Warning] No `error.tsx` Global Error Boundary

There is no `src/app/error.tsx` or `src/app/(protected)/error.tsx` file. An unhandled exception in any Server Component (e.g. an unguarded `null` dereference after a failed DB query) will surface a raw Next.js 500 page.

- Files: `src/app/` (missing `error.tsx`)
- Impact: Users see an unbranded crash page. Internal debugging detail may be exposed in development mode.
- Fix: Add `src/app/error.tsx` with a branded error UI and a "Go back to dashboard" button. Add `src/app/(protected)/error.tsx` for in-app errors.

---

### [Warning] No `.env.example` File

There is no `.env.example` or `.env.template` file documenting the required environment variables for new developers or deployment configurations.

- Files: Repository root (missing `.env.example`)
- Required variables (at minimum): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `NEXT_PUBLIC_APP_URL`, `SLACK_WORKSPACE_TOKENS`, `REMINDER_DATE_OVERRIDE`
- Fix: Create `.env.example` with all variables listed, values replaced with descriptive placeholders.

---

### [Info] Netlify Deployment with `@netlify/plugin-nextjs` — Potential Vercel Mismatch

The project deploys to **Netlify** (`netlify.toml`, `@netlify/plugin-nextjs`) but the CLAUDE.md and project skills reference **Vercel** as the target platform. Some Next.js features behave differently between adapters (especially middleware, ISR revalidation, and Edge Runtime).

- Files: `netlify.toml`, `package.json` (`@netlify/plugin-nextjs` in devDependencies)
- Impact: Documentation and skills advice may not match the actual deployment environment. Edge caching behavior, function timeouts, and middleware handling may differ.
- Fix: Align documentation with the actual deployment target or migrate to Vercel if that is the intended platform.

---

### [Info] Hardcoded Internal Emails in Migration

`supabase/migrations/00020_hr_admins_max_francesco.sql` contains hardcoded email addresses of specific individuals being granted HR_ADMIN access via a `UPDATE profiles SET role = 'HR_ADMIN' WHERE email IN (...)` migration.

- Files: `supabase/migrations/00020_hr_admins_max_francesco.sql`
- Impact: Personal email addresses are committed to version history permanently. While these are internal BCOMM emails, it sets a bad precedent for role management via migrations. Role grants should be done via the admin UI or a parameterized bootstrap script not committed to history.
- Fix: Use the admin UI (`/admin/users`) for role grants going forward. This migration cannot be removed from history, but new ones should not follow this pattern.

---

*Concerns audit: 2026-05-23*
