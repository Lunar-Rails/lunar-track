<!-- refreshed: 2026-05-23 -->
# Architecture

**Analysis Date:** 2026-05-23

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                                 │
│   Client Components ('use client') — forms, interactive UI, sidebar     │
│   `src/components/**` (interactive leaf components)                      │
└────────────────────────────┬────────────────────────────────────────────┘
                             │  HTTP / RSC streaming
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Next.js App Router (SSR)                              │
│   Server Components (page.tsx / layout.tsx) — data fetch + render       │
│   `src/app/(protected)/` — all authenticated pages                       │
│   `src/app/auth/callback/route.ts` — OAuth exchange route                │
└──────────┬───────────────────────────────────────────┬───────────────────┘
           │  Server Actions ('use server')             │  Direct DB queries
           │  `src/lib/actions/*.ts`                    │  via Supabase client
           ▼                                            ▼
┌──────────────────────────┐         ┌──────────────────────────────────────┐
│   Supabase Auth (GoTrue) │         │   Supabase PostgreSQL                 │
│   Google OAuth + SSR     │         │   RLS enforced at DB layer            │
│   cookies via @supabase/ssr│       │   `supabase/migrations/`             │
└──────────────────────────┘         └──────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Location |
|-----------|----------------|----------|
| Root layout | Fonts, ThemeProvider, NuqsAdapter | `src/app/layout.tsx` |
| Protected layout | Auth gate, onboarding redirect, period init, inbox count | `src/app/(protected)/layout.tsx` |
| Admin layout | HR_ADMIN role gate | `src/app/(protected)/admin/layout.tsx` |
| Page components | Server-side data fetch + render tree | `src/app/(protected)/*/page.tsx` |
| Server Actions | Mutations with Zod validation + revalidatePath | `src/lib/actions/*.ts` |
| Supabase server client | SSR cookie-based client, profile provisioning | `src/lib/supabase/server.ts` |
| Supabase browser client | Client-side reads (minimal use) | `src/lib/supabase/client.ts` |
| Domain types | All TypeScript interfaces + Database type map | `src/lib/types/database.ts` |

## Pattern Overview

**Overall:** Full-stack SSR with React Server Components as the primary rendering layer. Data mutations flow exclusively through Next.js Server Actions. Client components are leaf nodes used only for interactivity (forms, navigation state, charts).

**Key Characteristics:**
- `force-dynamic` on every page — no static generation, every request re-renders server-side
- No API routes for application logic — only `auth/callback/route.ts` and `onboarding/reset/route.ts` exist
- RLS enforced at the database layer; application layer adds a second check in Server Actions
- `revalidatePath` is called after every mutation to purge the Next.js router cache

## Layers

**Routing Layer:**
- Purpose: URL mapping, layout nesting, auth guards
- Location: `src/app/`
- Contains: `layout.tsx`, `page.tsx`, `route.ts` files
- Depends on: Supabase server client, Server Actions
- Used by: Browser

**Data Fetch Layer (Server Components):**
- Purpose: Fetch all data needed for a page using Supabase client directly
- Location: `src/app/(protected)/*/page.tsx`
- Contains: `async` Server Components with direct `supabase.from(...)` calls and `rpc()` calls
- Depends on: `src/lib/supabase/server.ts`, `src/lib/types/database.ts`
- Used by: React render tree

**Mutation Layer (Server Actions):**
- Purpose: All create/update/delete operations; Zod validation; RLS-backed writes
- Location: `src/lib/actions/*.ts`
- Contains: `'use server'` functions, always validates caller role before writing
- Depends on: `src/lib/supabase/server.ts`, Zod, `next/cache`
- Used by: Client Components (via form actions or direct calls)

**UI Layer (Client Components):**
- Purpose: Interactive forms, controlled inputs, navigation state
- Location: `src/components/**`
- Contains: `'use client'` components — forms, charts, dropdowns, sidebar
- Depends on: Server Actions (imported as async functions), Shadcn/ui, Tailwind
- Used by: Server Component page trees

**Database Layer:**
- Purpose: Data persistence, access control, hierarchy traversal
- Location: `supabase/migrations/`
- Contains: Tables, RLS policies, SECURITY DEFINER functions, closure table
- Used by: All Supabase client calls (RLS applies automatically)

## Data Flow

### Authenticated Page Request

1. Browser requests `/dashboard`
2. `(protected)/layout.tsx` — calls `supabase.auth.getUser()`, redirects to `/login` if no session
3. `getOrProvisionProfile()` — fetches or backfills `profiles` row
4. `ensureCurrentPeriod()` — idempotent quarter auto-creation/advancement
5. `dashboard/page.tsx` — parallel `Promise.all` fetches for check-ins, OKRs, scores, mood, quarterly check-in
6. Server Component renders full HTML; streamed to browser

### Mutation Flow (Server Action)

1. Client Component submits form or calls Server Action directly
2. Server Action (`'use server'`) — calls `createClient()` to get SSR Supabase client
3. Action fetches `getCallerProfile()` to validate identity + role
4. Zod schema validates all inputs
5. Supabase write — RLS policies enforce access at DB layer as a second gate
6. `revalidatePath(...)` called to invalidate router cache
7. Returns `{ success: true }` or `{ error: string }` to client

### OAuth Login Flow

1. User clicks "Sign in with Google" on `/login`
2. Supabase redirects to Google OAuth
3. Google redirects to `src/app/auth/callback/route.ts` with `?code=`
4. Route exchanges code for session via `supabase.auth.exchangeCodeForSession()`
5. Email domain checked against `ALLOWED_DOMAINS` in `src/lib/auth/allowed-domains.ts`
6. `upsert_profile_on_login` RPC called — creates/updates `profiles` row without overwriting `role`
7. Redirect to `/dashboard` (or `?next=` param)

### New Employee Onboarding Flow

1. New user completes OAuth — profile created with `is_onboarded = false`
2. Protected layout redirects `EMPLOYEE` with `is_onboarded = false` to `/onboarding`
3. Employee selects manager → `pending_manager_id` set, manager notified
4. Manager approves via `/inbox` → `approve_team_request` RPC called (sets `is_onboarded = true`, rebuilds org closure)
5. Employee can now access all protected routes

**State Management:**
- No client-side global state store (Zustand or similar) is present in this codebase currently
- URL state via `nuqs` (`NuqsAdapter` in root layout) for filter/tab params
- All application state is derived from Supabase on each server render

## Key Abstractions

**Performance Period:**
- Purpose: Time-scoped container (Q1–Q4 per year) for all check-ins, OKRs, and scores
- Auto-managed by `ensureCurrentPeriod()` in `src/lib/actions/period-actions.ts`
- Tables: `performance_periods`

**Org Closure Table:**
- Purpose: Efficient O(1) hierarchy queries without recursive CTE on hot paths
- Pattern: Each manager assignment change calls `rebuild_closure_for_employee()` SECURITY DEFINER function
- Used by: All RLS policies that check `private.is_in_my_subtree()`
- Tables: `org_closure` (`ancestor_id`, `descendant_id`, `depth`)

**SECURITY DEFINER Functions (private schema):**
- Purpose: Encapsulate role checks used in RLS policies without exposing logic to PostgREST
- Key functions: `private.current_user_role()`, `private.is_hr_admin()`, `private.is_in_my_subtree(target_user_id)`
- Location: `supabase/migrations/00001_foundation.sql`

**Dual-section Check-ins:**
- Purpose: Each check-in has an employee section (filled pre-meeting) and a manager section (filled post-meeting)
- Visibility gate: Manager can only see a check-in once `employee_submitted_at IS NOT NULL`
- Tables: `checkins` (monthly), `quarterly_checkins` (quarterly)

## Entry Points

**Root redirect (`/`):**
- Location: `src/app/page.tsx`
- Triggers: Any unauthenticated visit
- Responsibilities: Redirect to `/dashboard` (authenticated) or `/login` (unauthenticated)

**Protected layout:**
- Location: `src/app/(protected)/layout.tsx`
- Triggers: Every request to any `/(protected)/*` route
- Responsibilities: Auth gate, profile provisioning, onboarding redirect, period auto-advance, inbox count

**Auth callback:**
- Location: `src/app/auth/callback/route.ts`
- Triggers: Google OAuth redirect
- Responsibilities: Session exchange, domain validation, profile upsert

## Auth Model

**Provider:** Google OAuth via Supabase Auth (`@supabase/ssr`)

**Session storage:** HTTP-only cookies managed by `@supabase/ssr`. `createServerClient` reads/writes cookies via Next.js `cookies()`. `createBrowserClient` used for client-side reads only.

**Domain restriction:** `src/lib/auth/allowed-domains.ts` — enforced at the application layer in `auth/callback/route.ts`. Also enforced at DB layer via `supabase/migrations/00018_domain_whitelist.sql`.

**Profile provisioning:** `upsert_profile_on_login` SECURITY DEFINER RPC — never overwrites `role` or `manager_id` on re-login.

## 3-Tier Role Model

| Role | Access | Key Capabilities |
|------|--------|-----------------|
| `EMPLOYEE` | Own data only | Submit check-ins, manage own OKRs, view own scores (when unlocked) |
| `MANAGER` | Own data + subtree | Review reports' check-ins, approve OKRs, submit quarterly scores, view team |
| `HR_ADMIN` | All data | Everything above + admin panel, score calibration, org management, analytics |

**Enforcement layers:**
1. **Database RLS policies** — every table has policies using `private.is_in_my_subtree()` and `private.is_hr_admin()`. This is the primary enforcement layer.
2. **Layout-level gates** — `(protected)/admin/layout.tsx` redirects non-HR_ADMIN users to `/dashboard`
3. **Server Action guards** — every mutation action calls `getCallerProfile()` and checks `caller.role` before writing

**Score visibility gate:** `quarterly_scores.visible_to_employee` boolean. RLS policy `qscores_employee_read` only returns rows where `visible_to_employee = true`. HR_ADMIN unlocks scores per employee.

## Database Schema Overview

**Core tables:**

| Table | Purpose |
|-------|---------|
| `profiles` | One row per user; holds `role`, `manager_id`, `is_onboarded` |
| `org_closure` | Closure table for hierarchy; `ancestor_id / descendant_id / depth` |
| `performance_periods` | Q1–Q4 per year; `status: open|closed` |
| `okrs` | Employee goals per period; `status: DRAFT→PENDING_REVIEW→APPROVED|REVISION_REQUESTED` |
| `key_results` | Sub-items of OKRs with `progress_status` |
| `okr_initiatives` / `initiatives` | Sub-items of key results; `completed` boolean |
| `checkins` | Monthly check-ins; employee + manager dual-section; MIT arrays as JSONB |
| `quarterly_checkins` | Quarterly self-assessment; OKR progress, CSS, value self-assessments |
| `quarterly_scores` | Manager-submitted 1–5 scores per 3 dimensions; `visible_to_employee` gate |
| `annual_scores` | Computed + override annual scores; `suggested_*` vs `final_*` fields |
| `company_values` | 7 BCOMM values lookup table; `value_ratings` JSONB on quarterly_scores |
| `pulse_options` | Configurable mood/energy labels and colours |
| `guide_sections` | CMS-style content for the framework guide page |

**OKR lifecycle:** `DRAFT` → `PENDING_REVIEW` (employee submits for approval) → `APPROVED` or `REVISION_REQUESTED` (manager action)

**Scoring lifecycle:** Manager fills `quarterly_scores` → HR_ADMIN sets `visible_to_employee = true` → Employee can read score → HR_ADMIN finalizes `annual_scores`

## Architectural Constraints

- **`force-dynamic`:** Every page opts out of static generation. No ISR. All pages re-render on every request.
- **No middleware:** No `middleware.ts` file exists. Auth is enforced in layouts, not at the edge.
- **Type safety gap:** Supabase client calls are cast with `as any` throughout pages and Server Actions due to incomplete generated types. The manually-maintained `src/lib/types/database.ts` is the source of truth.
- **Deployment:** Netlify with `@netlify/plugin-nextjs`. Not Vercel. `netlify.toml` configures build + functions directory.
- **Notifications:** Resend email API via direct `fetch` in `src/lib/notifications.ts`. No-ops silently if `RESEND_API_KEY` is absent.
- **Threading:** Single-threaded Node.js event loop per Netlify function invocation.
- **Global state:** No module-level singletons. Supabase clients are created per-request.

## Anti-Patterns

### Repeated profile fetch inside pages

**What happens:** `dashboard/page.tsx` fetches `profiles` directly after the layout already fetched and validated the profile.
**Why it's wrong:** Redundant DB round-trip on the most-visited page.
**Do this instead:** Pass `profile` as a prop from the layout, or use React context to share the already-fetched profile down the Server Component tree.

### `as any` casts on Supabase client

**What happens:** Nearly all DB queries are prefixed with `(supabase as any)` before `.from(...)` or `.rpc(...)`.
**Why it's wrong:** Eliminates TypeScript type checking on query results; return types must be manually cast.
**Do this instead:** Run `supabase gen types typescript` to regenerate `src/lib/types/database.ts` with full column-level types, then remove all `as any` casts.

## Error Handling

**Strategy:** Server Actions return a discriminated union `{ success: true } | { error: string }`. Pages redirect on missing auth. No global error boundary is configured.

**Patterns:**
- Auth failures: `redirect('/login')` from layouts and pages
- Action failures: Return `{ error: 'message' }` string; client shows inline error
- Notification failures: Swallowed with `console.error` — non-fatal
- RPC schema cache misses: Explicit fallback to direct table queries in `getOrProvisionProfile()`

## Cross-Cutting Concerns

**Logging:** `console.error` for server-side errors; `console.log` for dev-mode notification previews. No structured logging.
**Validation:** Zod schemas defined inline within each Server Action. Client forms use React Hook Form with the same Zod schema via `@hookform/resolvers`.
**Authentication:** Enforced at three layers — layout redirect, Server Action role check, and Supabase RLS.
**Email notifications:** `src/lib/notifications.ts` — triggered from Server Actions after mutations (check-in submitted, check-in reviewed, OKR approved/revised).

---

*Architecture analysis: 2026-05-23*
