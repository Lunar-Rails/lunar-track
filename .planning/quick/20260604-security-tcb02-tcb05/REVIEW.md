---
phase: 20260604-security-tcb02-tcb05
reviewed: 2026-06-04T16:35:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - src/middleware.ts
  - src/lib/auth/allowed-domains.ts
  - src/lib/auth/check-domain-action.ts
  - src/app/auth/callback/route.ts
  - src/components/auth/MagicLinkForm.tsx
  - src/app/(protected)/layout.tsx
  - supabase/migrations/00033_allowed_domains_table.sql
  - supabase/migrations/00034_upsert_uses_allowed_domains.sql
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Security Remediation T-CB-02 / T-CB-05: Code Review Report

**Reviewed:** 2026-06-04T16:35:00Z  
**Depth:** deep (cross-file call chain analysis)  
**Files Reviewed:** 8  
**Status:** issues_found

## Summary

Two blockers, both introduced by this PR. The most dangerous is a missed `await` on the now-async `isAllowedEmail` in `src/lib/supabase/server.ts` — a call site that was not updated when the function's signature changed in T-CB-02. In the schema-cache-miss fallback path the domain check becomes `!Promise` (always `false`), silently bypassing domain enforcement and allowing any email domain to provision a profile. The second blocker is a `GATE_EXEMPT_PREFIXES` misconfiguration: `/dashboard` is listed as exempt, which means the first-check-in gate (T-CB-05's entire purpose) never fires for the main landing page — the gate was activated but doesn't guard the route new employees land on.

The SQL migration, RLS design, `maybeSingle()` choice, `SECURITY DEFINER` + `SET search_path`, and migration ordering are all correct. The `callback/route.ts` await and Server Action pattern are correct.

---

## Critical Issues

### CR-01: Missing `await` on async `isAllowedEmail` in fallback path — domain check silently bypassed

**File:** `src/lib/supabase/server.ts:64`  
**Issue:** T-CB-02 changed `isAllowedEmail` from `sync → async`. Two of the three call sites were updated to `await`. The third — the schema-cache-miss fallback inside `getOrProvisionProfile` — was not. The expression `!isAllowedEmail(user.email)` evaluates `!Promise<boolean>`. A `Promise` object is always truthy, so `!Promise` is always `false`. The overall condition `!user.email || !isAllowedEmail(user.email)` collapses to `!user.email`, meaning: _any_ authenticated user with an email (regardless of domain) passes the domain check in this path. A `@gmail.com` address will provision a profile when the PostgREST schema cache is cold.

This is the fallback path triggered when `upsert_profile_on_login` returns an RPC error with the message `"schema cache"`. Supabase PostgREST schema cache misses do occur after migrations — precisely the moment after deploying 00033 and 00034 when this vulnerability is most exposed.

**Fix:**
```typescript
// src/lib/supabase/server.ts:64
// Before:
if (!user.email || !isAllowedEmail(user.email)) {

// After:
if (!user.email || !await isAllowedEmail(user.email)) {
```

---

### CR-02: `/dashboard` in `GATE_EXEMPT_PREFIXES` — first-check-in gate never fires for main landing page

**File:** `src/middleware.ts:13`  
**Issue:** The T-CB-05 fix's stated goal is: "Onboarded employees who haven't submitted a check-in [should not be able to] access all routes." The PLAN's own verification test is: _"Hit `/dashboard` as an onboarded employee with 0 check-ins → expect redirect to `/checkins`."_ `/dashboard` is the protected app's root — the URL every authenticated user lands on. Because it appears in `GATE_EXEMPT_PREFIXES`, the gate never evaluates for this path. A brand-new onboarded employee can sit on `/dashboard` indefinitely without being prompted to submit their first check-in. The gate only fires for routes not starting with any exempt prefix; in practice almost every real navigation path is covered by one of the nine exempt prefixes.

**Fix:** Remove `/dashboard` from `GATE_EXEMPT_PREFIXES`. The whole point of the gate is to intercept the dashboard visit and redirect to `/checkins`.

```typescript
const GATE_EXEMPT_PREFIXES = [
  '/checkins',
  '/guide',
  '/login',
  '/auth',
  '/onboarding',
  '/settings',
  // '/dashboard',  <-- remove; gate must fire here
  '/org',
  '/team',
]
```

---

## Warnings

### WR-01: `!count` conflates query error (`null`) with zero check-ins (`0`) — spurious redirects on DB error

**File:** `src/middleware.ts:82`  
**Issue:** When Supabase returns `{ count: null, error: ... }` on a failed query, `!count` is `true` — the same as `count === 0`. Any transient DB error during the `checkins` count query will force-redirect every matching user to `/checkins`, even users who have submitted check-ins. The redirect will persist until the DB recovers.

**Fix:**
```typescript
// Before:
if (!count) {

// After:
if (count === 0) {
```

---

### WR-02: DB error in `isAllowedEmail` silently treated as "domain not allowed" — blocks legitimate logins during DB outage

**File:** `src/lib/auth/allowed-domains.ts:8-14`  
**Issue:** The query result's `error` field is never inspected. If the `allowed_domains` table is temporarily unreachable (connection pool exhausted, Supabase maintenance), `data` will be `null` and `!!data` returns `false`. Legitimate `@lunarrails.io` users will be rejected with a domain error during any DB outage — with no log entry to diagnose why.

**Fix:**
```typescript
export async function isAllowedEmail(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('allowed_domains')
    .select('domain')
    .eq('domain', domain)
    .maybeSingle()

  if (error) {
    console.error('[allowed-domains] DB error during domain check:', error.message)
    // Fail open (let SQL gate enforce) or fail closed — choose per policy.
    // Fail closed shown here:
    return false
  }

  return !!data
}
```

At minimum, log the error. Whether to fail open or closed is a policy call — but the error should never be silently swallowed.

---

### WR-03: Profile DB query runs for every non-exempt authenticated request, including HR admins who bypass the gate

**File:** `src/middleware.ts:68-73`  
**Issue:** The profile query (`.from('profiles').select('role, is_onboarded')...`) executes for every authenticated, non-exempt request — including `HR_ADMIN` users, who then pass through the inner role check without triggering any gate logic. This is an extra DB round-trip on every page load for all users. On busy paths (e.g., `/reports`, `/performance`) this doubles the DB read cost per request.

**Fix:** Short-circuit before querying if the path is not one that the gate would act on, or move the profile fetch inside the inner check:

```typescript
if (user && !GATE_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) {
  const { data: profileRow } = await (supabase as any)
    .from('profiles')
    .select('role, is_onboarded')
    .eq('id', user.id)
    .maybeSingle()  // also: prefer maybeSingle over single here

  if (
    profileRow?.is_onboarded &&
    (profileRow.role === 'EMPLOYEE' || profileRow.role === 'MANAGER')
  ) {
    // ... count query only runs for EMPLOYEE/MANAGER
  }
}
```

The structure is already correct — the count query is guarded — but the profile query itself has no early exit for HR_ADMIN. An alternative is to cache the role in the session token via a Supabase JWT claim, eliminating the DB lookup entirely.

---

### WR-04: `src/lib/auth/allowed-domains.ts` has no `server-only` import — documented as server-only but not enforced

**File:** `src/lib/auth/allowed-domains.ts:1`  
**Issue:** The module calls `createClient()` from `@/lib/supabase/server` which calls `cookies()` from `next/headers` — this chain will fail at build time if the module is imported from a client component directly. However, the failure is an indirect runtime/build error rather than an explicit compile-time module boundary violation. The PLAN described this as a "server-only" module; the `server-only` package enforces this with a clear error message.

**Fix:**
```typescript
import 'server-only'
import { createClient } from '@/lib/supabase/server'
// ...
```

---

## Info

### IN-01: `.single()` on profile fetch in middleware should be `.maybeSingle()` for semantic clarity

**File:** `src/middleware.ts:71`  
**Issue:** `.single()` signals "I expect exactly one row; error if zero or multiple." For a profile lookup by primary key where absence is a valid state (new user before first provisioning), `.maybeSingle()` better documents intent. The current code handles the null case gracefully via optional chaining, so this is not a correctness issue.

**Fix:** Replace `.single()` with `.maybeSingle()` on line 71.

---

### IN-02: RLS policy diverges from PLAN — `anon` SELECT was added but not documented in migration comments

**File:** `supabase/migrations/00033_allowed_domains_table.sql:13-15`  
**Issue:** The PLAN specified `TO authenticated` on the SELECT policy. The actual migration uses `USING (true)` without a role clause, which grants SELECT to both `anon` and `authenticated`. The inline comment explains the reasoning ("pre-auth form validation"), and the change is correct — the `checkDomainAction` server action is called from the pre-auth form where no session exists, so the anon key must be able to read the table. However, this is a deliberate security-relevant deviation from the plan spec and warrants a security note in the migration.

**Fix:** Add a comment documenting the deliberate choice:
```sql
-- Intentionally includes anon role: the domain check runs pre-authentication
-- (MagicLinkForm calls checkDomainAction before a session exists).
-- Domain names are non-sensitive; no credentials or PII are exposed.
CREATE POLICY "Anyone can read allowed_domains"
  ON allowed_domains FOR SELECT
  USING (true);
```

---

### IN-03: No input length validation on `email` in `checkDomainAction` before DB query

**File:** `src/lib/auth/check-domain-action.ts:5`  
**Issue:** The server action accepts an unbounded string. A caller could pass a 10 MB email string, which would be passed directly to the Supabase query. The `domain` extracted from `split('@')[1]` could also be arbitrarily long. Parameterised queries prevent SQL injection, and Next.js Server Actions enforce same-origin, so the practical risk for an internal tool is low — but a basic length guard is good hygiene.

**Fix:**
```typescript
export async function checkDomainAction(email: string): Promise<{ allowed: boolean; error: string | null }> {
  if (!email || email.length > 320) {
    return { allowed: false, error: DOMAIN_ERROR_MESSAGE }
  }
  const allowed = await isAllowedEmail(email)
  return { allowed, error: allowed ? null : DOMAIN_ERROR_MESSAGE }
}
```

---

_Reviewed: 2026-06-04T16:35:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: deep_
