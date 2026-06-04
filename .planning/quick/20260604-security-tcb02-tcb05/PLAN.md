# Fix T-CB-02 & T-CB-05 — Security Remediation Plan

**Created:** 2026-06-04
**Source:** `.planning/SECURITY.md` open threats

---

## T-CB-02: Domain whitelist split-brain

### Problem

Two independent domain whitelists that must agree but don't:

| Source | File | Domains |
|--------|------|---------|
| TypeScript (app layer) | `src/lib/auth/allowed-domains.ts:3-9` | lunarrails.io, **clovrlabs.com**, 40acres.pro, chainlabs.ai, podproza.cz, osirisconcepts.com |
| SQL (DB layer) | `supabase/migrations/00018_domain_whitelist.sql:15-16` | lunarrails.io, 40acres.pro, chainlabs.ai, podproza.cz, osirisconcepts.com |

`clovrlabs.com` passes the TS check in the callback route but gets rejected by the SQL RPC `upsert_profile_on_login`, meaning clovrlabs users can authenticate but fail to provision a profile → get redirected to `/login?error=provision`.

### Design Decision: Single Source of Truth

**DB-authoritative. Remove TS hardcoded list.**

Rationale:
1. Adding a domain becomes a single DB operation (insert into `allowed_domains` table) — no code deploy, no PR, no two-list drift.
2. The SQL `upsert_profile_on_login` function already enforces at the database layer — promoting it to _the_ authority eliminates the split-brain by design.
3. HR/admin can manage domains via Supabase dashboard or a future admin UI without developer involvement.
4. The TS helper `isAllowedEmail()` becomes a thin RPC/query wrapper — still usable in the callback route for early rejection, but reads from the DB rather than a hardcoded array.

### Implementation Tasks

#### Task 1: Create `allowed_domains` table + seed migration

Create `supabase/migrations/00034_allowed_domains_table.sql`:

```sql
-- Single source of truth for login domain whitelist.
-- To add a domain: INSERT INTO allowed_domains (domain) VALUES ('example.com');
CREATE TABLE IF NOT EXISTS allowed_domains (
  domain TEXT PRIMARY KEY CHECK (domain = lower(domain)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: readable by authenticated users (needed for client-side validation UX),
-- writable only via service role / migrations.
ALTER TABLE allowed_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read allowed_domains"
  ON allowed_domains FOR SELECT
  TO authenticated
  USING (true);

-- Seed with current whitelist (superset of both TS and SQL lists)
INSERT INTO allowed_domains (domain) VALUES
  ('lunarrails.io'),
  ('clovrlabs.com'),
  ('40acres.pro'),
  ('chainlabs.ai'),
  ('podproza.cz'),
  ('osirisconcepts.com')
ON CONFLICT DO NOTHING;
```

#### Task 2: Update `upsert_profile_on_login` to query the table

Create `supabase/migrations/00035_upsert_uses_allowed_domains.sql`:

```sql
CREATE OR REPLACE FUNCTION upsert_profile_on_login(
  user_id         UUID,
  user_email      TEXT,
  user_full_name  TEXT,
  user_avatar_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_domain TEXT := lower(split_part(user_email, '@', 2));
BEGIN
  IF NOT EXISTS (SELECT 1 FROM allowed_domains WHERE domain = email_domain) THEN
    RAISE EXCEPTION 'Email domain not allowed: %', email_domain;
  END IF;

  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (user_id, user_email, user_full_name, user_avatar_url)
  ON CONFLICT (id) DO UPDATE
    SET
      full_name  = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = now();

  INSERT INTO org_closure (ancestor_id, descendant_id, depth)
  VALUES (user_id, user_id, 0)
  ON CONFLICT DO NOTHING;
END;
$$;
```

#### Task 3: Rewrite `src/lib/auth/allowed-domains.ts` to query DB

Replace the hardcoded array with a server-side query:

```ts
import { createClient } from '@/lib/supabase/server'

export async function isAllowedEmail(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false

  const supabase = await createClient()
  const { data } = await supabase
    .from('allowed_domains')
    .select('domain')
    .eq('domain', domain)
    .single()

  return !!data
}

export const DOMAIN_ERROR_MESSAGE =
  'Sign-in is restricted to authorized company domains.'
```

**Note:** This changes `isAllowedEmail` from sync → async. Update call sites accordingly.

#### Task 4: Update call sites for async `isAllowedEmail`

- `src/app/auth/callback/route.ts:44` — already in an async function, just add `await`.
- `src/components/auth/MagicLinkForm.tsx` — if client-side validation uses this, either call a lightweight server action or remove client-side domain check (the DB gate catches it server-side regardless).

#### Task 5: Update SECURITY.md

Set T-CB-02 status to **closed** with evidence: `allowed_domains` table is the single source, `upsert_profile_on_login` queries it, TS reads from it.

---

## T-CB-05: Dead middleware (`src/proxy.ts`)

### Problem

- Next.js expects `src/middleware.ts` exporting a named `middleware` function.
- The project has `src/proxy.ts` exporting a named `proxy` function.
- Nothing imports `proxy.ts` → the entire module is dead code.
- Two features live in the dead proxy:
  1. **Unauthenticated redirect to `/login`** — already covered by `(protected)/layout.tsx:16-17`.
  2. **First-check-in gate** — NOT covered anywhere else. Onboarded employees who haven't submitted a check-in can access all routes.

### Design Decision: Activate vs. Remove

**Recommended: Rename to `src/middleware.ts` with export rename.**

Rationale:
1. The first-check-in gate is an intentional feature (it's in the security audit), not leftover code.
2. Middleware runs at the edge before the page renders — better UX (no flash of protected content) and lighter on the server (skips RSC rendering for unauthorized requests).
3. The layout already handles the simple auth redirect, so middleware is purely additive (first-check-in gate + cookie refresh).

### Implementation Tasks

#### Task 1: Rename file and export

```bash
mv src/proxy.ts src/middleware.ts
```

In the new `src/middleware.ts`, rename the export:

```ts
// Before (line 18):
export async function proxy(request: NextRequest) {
// After:
export async function middleware(request: NextRequest) {
```

Keep the `config` export as-is — the `matcher` is already correct.

#### Task 2: Remove type casts

The current code uses `(supabase as any)` casts. These should be replaced with properly typed calls or kept with an explicit comment explaining why (the Database type may not include `checkins.employee_submitted_at`). Minor cleanup, not blocking.

#### Task 3: Test path matching

Verify the middleware `config.matcher` doesn't interfere with:
- `/login`, `/auth/*` (must pass through without redirect loop)
- `/_next/static/*`, `/_next/image/*` (already excluded by regex)
- `/api/*` routes (if any exist; currently none)

Manual test: hit `/` unauthenticated → expect redirect to `/login`. Hit `/dashboard` as an onboarded employee with 0 check-ins → expect redirect to `/checkins`.

#### Task 4: Remove redundant auth check from layout (optional)

The protected layout's `getUser()` redirect is now redundant with middleware, but keeping it as defense-in-depth is acceptable. Mark with a comment:

```ts
// Defense-in-depth: middleware already redirects, but layout catches edge cases
```

#### Task 5: Update SECURITY.md

Set T-CB-05 status to **closed** with evidence: `src/middleware.ts` glob matches, exports `middleware`.

---

## Execution Order

1. **T-CB-05 first** — the rename is lower-risk and doesn't touch migrations.
2. **T-CB-02 second** — the new migration is a CREATE OR REPLACE that's safe to apply.
3. **SECURITY.md update** — after both are verified.

## Verification

- `npx tsc --noEmit` passes (async signature change compiles)
- `npx next build` succeeds (middleware detected)
- `supabase db push` applies migrations 00034 + 00035 cleanly
- `SELECT * FROM allowed_domains` returns all 6 domains
- `grep -r "proxy" src/` returns no stale references
- `src/lib/auth/allowed-domains.ts` contains no hardcoded domain array
- Login with a `clovrlabs.com` email succeeds (no more provision error)
