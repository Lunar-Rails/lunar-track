# Code Review — LunarTrack
**Date:** 2026-05-23
**Depth:** Deep (cross-file analysis)

## Summary
**15 Critical, 14 Warning, 5 Info** — 34 total findings

---

## Critical Findings

### [CR-01] Open Redirect in OAuth Callback
**Severity:** Critical
**File:** `src/app/auth/callback/route.ts:8,45`
**Issue:** The `next` query parameter is appended to `origin` without validation. `?next=//evil.com/steal` redirects an authenticated user to an attacker-controlled domain after login.
**Fix:** Validate `next` starts with `/` and does not contain `//` or `://`.

---

### [CR-02] RLS Policy Allows Role Self-Escalation to HR_ADMIN
**Severity:** Critical
**File:** `supabase/migrations/00001_foundation.sql:241-244`
**Issue:** `profiles_self_update_meta` has `WITH CHECK (id = auth.uid())` with no column restriction. Any authenticated user can PATCH their own `role` to `HR_ADMIN` via a direct PostgREST call using their session JWT and the public anon key.
**Fix:** Add `AND role = (SELECT role FROM profiles WHERE id = auth.uid())` to the WITH CHECK clause.

---

### [CR-03] `src/proxy.ts` Is Dead Code — Middleware Never Runs
**Severity:** Critical
**File:** `src/proxy.ts`
**Issue:** The function is exported as `proxy`, not `default`, and the file is named `proxy.ts` not `middleware.ts`. Next.js never invokes it. The entire server-side auth guard is dead.
**Fix:** Rename to `src/middleware.ts`, rename the export to `middleware`.

---

### [CR-04] Domain Whitelist Bypass via `getOrProvisionProfile` Fallback
**Severity:** Critical
**File:** `src/lib/supabase/server.ts:61-75`
**Issue:** When the RPC fails with a schema-cache error, the fallback inserts a profile row directly with no domain check. Any Supabase-authenticated user can gain app access regardless of email domain.
**Fix:** Call `isAllowedEmail(user.email)` before the fallback insert and return `null` if it fails.

---

### [CR-05] `updateOkr` Data Loss: All Key Results Deleted Before Re-Insert With No Rollback
**Severity:** Critical
**File:** `src/lib/actions/okr-actions.ts:145-168`
**Issue:** Key results are deleted unconditionally. If a subsequent re-insert fails, the function returns an error but the OKR now has zero key results permanently. There is no transaction.
**Fix:** Wrap in an RPC/transaction, or insert first then delete-by-diff.

---

### [CR-06] `upsertQuarterlyScore` Update Path Silently Returns Success on DB Failure
**Severity:** Critical
**File:** `src/lib/actions/performance-actions.ts:131`
**Issue:** The update return value is discarded; DB failures return `{ success: true }`.
**Fix:** Destructure `{ error }` and return error on failure.

---

### [CR-07] `finalizeAnnualScore` Update Path Silently Returns Success on DB Failure
**Severity:** Critical
**File:** `src/lib/actions/performance-actions.ts:265`
**Issue:** Annual score update errors are silently swallowed.
**Fix:** Same as CR-06.

---

### [CR-08] `upsertCheckinEmployee` Update Path Silently Returns Success on DB Failure
**Severity:** Critical
**File:** `src/lib/actions/checkin-actions.ts:118`
**Issue:** Monthly check-in update errors are silently swallowed. Users receive false confirmation that data was saved.
**Fix:** Destructure `{ error }` and return error on failure.

---

### [CR-09] `upsertQuarterlyCheckinEmployee` Update Path Silently Returns Success on DB Failure
**Severity:** Critical
**File:** `src/lib/actions/quarterly-checkin-actions.ts:119`
**Issue:** Quarterly check-in update errors are silently swallowed.
**Fix:** Same as CR-06.

---

### [CR-10] HTML Injection in Email Templates
**Severity:** Critical
**File:** `src/lib/notifications.ts:151-155`
**Issue:** `okrTitle`, `comment`, `managerName`, and `employeeName` are interpolated directly into raw HTML. An employee who sets an OKR title to `</blockquote><script>...</script>` injects arbitrary HTML into emails to their manager.
**Fix:** Add an `esc()` helper and apply to all user-supplied strings.
```typescript
const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
```

---

### [CR-11] `transitionOkrStatus` Update Silently Returns Success on DB Failure
**Severity:** Critical
**File:** `src/lib/actions/okr-actions.ts:239-243`
**Issue:** OKR status update error is discarded; email notification fires for a status change that never persisted.
**Fix:** Check `{ error }` from the update before sending notification.

---

### [CR-12] `deleteOkr` Soft-Delete Silently Returns Success on DB Failure
**Severity:** Critical
**File:** `src/lib/actions/okr-actions.ts:189`
**Issue:** Soft-delete error is discarded; UI removes the OKR from view but the DB record is unchanged, causing it to reappear on next load.
**Fix:** Destructure `{ error }` and return error on failure.

---

### [CR-13] `deleteOkr` No Status Guard — Approved OKRs Can Be Deleted
**Severity:** Critical
**File:** `src/lib/actions/okr-actions.ts:175-193`
**Issue:** No status check; an employee can soft-delete an `APPROVED` OKR. `updateOkr` has this guard; `deleteOkr` does not.
**Fix:** Fetch `status` and block delete of `APPROVED`/`PENDING_REVIEW` OKRs.

---

### [CR-14] `syncNextQuarterGoalsToOkrs` Can Un-Delete Soft-Deleted Approved OKRs
**Severity:** Critical
**File:** `src/lib/actions/quarterly-checkin-actions.ts:301-312`
**Issue:** The upsert unconditionally sets `deleted_at: null` on conflict, reversing any previous soft-delete of an approved OKR.
**Fix:** Add `ignoreDuplicates: true` or only set `deleted_at: null` when explicitly re-activating.

---

### [CR-15] `ensureCurrentPeriod` Called on Every Request for Every User, Write Errors Silently Discarded
**Severity:** Critical
**File:** `src/app/(protected)/layout.tsx:31` + `src/lib/actions/period-actions.ts:46-78`
**Issue:** A write-capable action is called from the layout on every authenticated page load for all roles. All insert/update errors are silently discarded.
**Fix:** Move to a scheduled function or admin-only trigger with the service role key.

---

## Warning Findings

### [WR-01] `deleteQuarterlyCheckin` Has No Submitted-Status Guard
**Severity:** Warning
**File:** `src/lib/actions/quarterly-checkin-actions.ts:234`
**Issue:** Employees can delete submitted quarterly check-ins, removing manager visibility into completed quarters. Monthly check-in action has this guard; quarterly does not.
**Fix:** Check `employee_submitted_at` and block deletion if set.

---

### [WR-02] `upsert_profile_on_login` Overwrites Display Name on Every Login
**Severity:** Warning
**File:** `supabase/migrations/00018_domain_whitelist.sql:21-27`
**Issue:** Always updates `full_name`/`avatar_url` from the OAuth provider on re-login, reverting any admin-set display name changes.
**Fix:** Only update when current values are `NULL`.

---

### [WR-03] Domain Whitelist Duplicated in Two Places
**Severity:** Warning
**Files:** `src/lib/auth/allowed-domains.ts:3-8`, `supabase/migrations/00018_domain_whitelist.sql:15-18`
**Issue:** Allowed domains are maintained separately in TypeScript and SQL. A domain added to one but not the other causes silent login failures or security gaps.
**Fix:** Make the DB authoritative; have the TS file query the DB, or add a test that asserts both sets are identical.

---

### [WR-04] Non-Atomic OKR Creation — Partial Objects Can Persist
**Severity:** Warning
**File:** `src/lib/actions/okr-actions.ts:70-100`
**Issue:** Sequential inserts for key results and initiatives. If a mid-loop insert fails, partial cleanup may also fail, leaving an OKR with missing key results in the DB.
**Fix:** Use a single batch `.insert([...array])` or wrap in an RPC transaction.

---

### [WR-05] Netlify Slack Reminder Function Has No Request Authentication
**Severity:** Warning
**File:** `netlify/functions/slack-reminders.mts:22`
**Issue:** HTTP handler accepts any GET request with no bearer token or secret. Direct URL invocation sends Slack DMs to all pending users.
**Fix:** Add `if (request.headers.get('x-reminder-secret') !== process.env.REMINDER_SECRET) return new Response('Forbidden', { status: 403 })`.

---

### [WR-06] Slack Reminders Sent to All Roles Including Managers and HR Admins
**Severity:** Warning
**File:** `netlify/functions/slack-reminders.mts:57-60`
**Issue:** Fetches ALL profiles with no role filter; managers and HR admins who aren't expected to submit check-ins receive reminders.
**Fix:** Add `.eq('role', 'EMPLOYEE')` filter.

---

### [WR-07] `approveTeamRequest`/`declineTeamRequest` Have No Application-Layer Role Check
**Severity:** Warning
**File:** `src/lib/actions/onboarding-actions.ts:42-73`
**Issue:** Authorization relies entirely on DB RPC behavior, inconsistent with every other action that performs an explicit role check first.
**Fix:** Add explicit caller role check before the RPC calls, consistent with `verifyHRAdmin` in admin-actions.ts.

---

### [WR-08] `get_subordinates` SECURITY DEFINER With No Caller Check
**Severity:** Warning
**File:** `supabase/migrations/00001_foundation.sql:111-137`
**Issue:** Any authenticated user can call this RPC and retrieve any manager's full subtree of profile data.
**Fix:** Add `IF (SELECT id FROM profiles WHERE id = auth.uid()) IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;` and optionally restrict to own subtree.

---

### [WR-09] `compute_annual_averages` SECURITY DEFINER With No Caller Check
**Severity:** Warning
**File:** `supabase/migrations/00003_performance_cycle.sql:171-197`
**Issue:** Any employee can retrieve another employee's aggregated quarterly scores, bypassing the `visible_to_employee` flag.
**Fix:** Add a caller check: only allow if `auth.uid() = p_employee_id` or caller is MANAGER/HR_ADMIN.

---

### [WR-10] Last HR_ADMIN Lockout Not Prevented
**Severity:** Warning
**File:** `src/lib/actions/user-actions.ts:35-37`
**Issue:** `updateUserRole` prevents self-demotion but not mutual lockout (two admins can demote each other to eliminate all HR_ADMINs).
**Fix:** Check `COUNT(*) WHERE role = 'HR_ADMIN' AND id != target_id > 0` before allowing demotion.

---

### [WR-11] Employee PII Committed to Version History in Seed Migration
**Severity:** Warning
**File:** `supabase/migrations/00010_org_structure.sql:13-52`
**Issue:** Full names and work emails for ~38 employees are permanently embedded in git history as a seed migration.
**Fix:** Cannot be removed from history without a rewrite. Future role grants and org changes should go through the admin UI, not migrations.

---

### [WR-12] Duplicate Migration Number `00019`
**Severity:** Warning
**Files:** `supabase/migrations/00019_ai_builder_and_values.sql`, `supabase/migrations/00019_mood_tracking.sql`
**Issue:** Non-deterministic apply order between the two files. Supabase CLI may reject the second file.
**Fix:** Renumber one to `00020` and increment subsequent migrations.

---

### [WR-13] Submit Race Condition — Double-Submit Possible
**Severity:** Warning
**Files:** `src/lib/actions/checkin-actions.ts:87-98`, `src/lib/actions/quarterly-checkin-actions.ts:92-101`
**Issue:** Check-then-act: concurrent requests can both pass the `employee_submitted_at IS NULL` check and both complete the submit. Should use a conditional update with `.is('employee_submitted_at', null)` in the WHERE clause.
**Fix:** Replace SELECT+check with conditional UPDATE: `.update({ employee_submitted_at: now }).is('employee_submitted_at', null)` and check `count === 0` for already-submitted.

---

### [WR-14] Fallback Profile Provisioning Skips `org_closure` Insert
**Severity:** Warning
**File:** `src/lib/supabase/server.ts:61-75`
**Issue:** The RPC-error fallback creates a profiles row but not the corresponding `org_closure` self-row, making the user invisible to hierarchy queries until manually fixed.
**Fix:** After fallback insert, also insert the self-row into `org_closure`.

---

## Info Findings

### [IN-01] Silent Incomplete User Deletion Without Service Role Key
**Severity:** Info
**File:** `src/lib/actions/admin-actions.ts:31-38`
**Issue:** When `SUPABASE_SERVICE_ROLE_KEY` is absent, only the profiles row is deleted. The auth.users entry survives and the user can re-authenticate.
**Fix:** Make the service role key required, or show a clear warning in the admin UI when deletion is incomplete.

---

### [IN-02] All OKRs Created Directly as `APPROVED` — Review Workflow Bypassed
**Severity:** Info
**File:** `src/lib/actions/okr-actions.ts:61`
**Issue:** New OKRs are inserted with `status: 'APPROVED'`, skipping the DRAFT → PENDING_REVIEW workflow that the rest of the codebase implements.
**Fix:** Clarify intent. If bypass is intentional, remove the unused DRAFT/PENDING_REVIEW UI machinery.

---

### [IN-03] ~80 `(supabase as any)` Casts Defeat TypeScript Schema Validation
**Severity:** Info
**Files:** All action files and protected pages
**Issue:** The `Database` type is threaded through the client but cast to `any` at every call site. Schema changes produce runtime errors TypeScript cannot catch.
**Fix:** Regenerate `src/lib/types/database.ts` with `supabase gen types typescript` and remove the casts.

---

### [IN-04] No `.env.example` File
**Severity:** Info
**File:** Repository root (missing)
**Required variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `NEXT_PUBLIC_APP_URL`, `SLACK_WORKSPACE_TOKENS`, `REMINDER_DATE_OVERRIDE`

---

### [IN-05] Fire-and-Forget Email Notifications May Silently Drop
**Severity:** Info
**Files:** `src/lib/actions/checkin-actions.ts:151`, `src/lib/actions/quarterly-checkin-actions.ts:165`
**Issue:** `void notifyManager...()` fires and forgets. Errors are silently dropped and the promise may not resolve before the serverless runtime terminates.
**Fix:** `await` the notification call and handle errors, or move to a queued background job.

---

## Findings by File

| File | Critical | Warning | Info |
|------|----------|---------|------|
| `src/lib/actions/okr-actions.ts` | CR-05, CR-11, CR-12, CR-13 | WR-04 | IN-02 |
| `src/lib/actions/performance-actions.ts` | CR-06, CR-07 | — | — |
| `src/lib/actions/checkin-actions.ts` | CR-08 | WR-13 | IN-05 |
| `src/lib/actions/quarterly-checkin-actions.ts` | CR-09, CR-14 | WR-01, WR-13 | — |
| `src/lib/notifications.ts` | CR-10 | — | — |
| `src/lib/supabase/server.ts` | CR-04 | WR-14 | — |
| `src/app/auth/callback/route.ts` | CR-01 | — | — |
| `src/proxy.ts` | CR-03 | — | — |
| `src/app/(protected)/layout.tsx` | CR-15 | — | — |
| `supabase/migrations/00001_foundation.sql` | CR-02 | WR-08 | — |
| `supabase/migrations/00003_performance_cycle.sql` | — | WR-09 | — |
| `supabase/migrations/00018_domain_whitelist.sql` | — | WR-02, WR-03 | — |
| `supabase/migrations/00019_*.sql` | — | WR-12 | — |
| `supabase/migrations/00010_org_structure.sql` | — | WR-11 | — |
| `src/lib/actions/onboarding-actions.ts` | — | WR-07 | — |
| `src/lib/actions/user-actions.ts` | — | WR-10 | — |
| `netlify/functions/slack-reminders.mts` | — | WR-05, WR-06 | — |
| `src/lib/auth/allowed-domains.ts` | — | WR-03 | — |
| `src/lib/actions/admin-actions.ts` | — | — | IN-01 |
| All action files + pages | — | — | IN-03 |
| Repository root | — | — | IN-04 |

---

*Review date: 2026-05-23*
