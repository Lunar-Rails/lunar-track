---
last_mapped_commit: 804cf743d1651aa9bd1d761c60c4d1478e38a540
---

<!-- refreshed: 2026-06-04 -->
# Architecture

**Analysis Date:** 2026-06-04

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Browser (React 19 client islands)                │
│  Forms, charts, sheets — `src/components/**` (use client where needed) │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ Server Actions + RSC props
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Next.js 16 App Router — `src/app/**`                        │
│  RSC pages (data fetch) │ Route handlers │ Layouts (auth shell)        │
└───────┬─────────────────────────────┬───────────────────┬───────────────┘
        │                             │                   │
        ▼                             ▼                   ▼
┌───────────────┐           ┌─────────────────┐   ┌──────────────────────┐
│ src/proxy.ts  │           │ src/lib/actions │   │ Netlify scheduled fns  │
│ Request gate  │           │ Mutations + Zod │   │ `netlify/functions/*`  │
│ (auth redirect│           │ revalidatePath  │   │ service-role Supabase  │
│  first-checkin)│          └────────┬────────┘   └──────────┬───────────┘
└───────┬───────┘                   │                         │
        │                           ▼                         │
        │              ┌────────────────────────────────────────┐
        └─────────────►│ Supabase (Auth + PostgreSQL + RLS)   │
                       │ `supabase/migrations/*.sql`            │
                       │ RPC: hierarchy, invites, scoring       │
                       └────────────────────────────────────────┘
                                │
                                ▼
                       ┌────────────────────────────────────────┐
                       │ External: Mailtrap, Slack, OpenAI      │
                       │ `src/lib/notifications.ts`, `slack.ts` │
                       └────────────────────────────────────────┘
```

**Product:** CiaoBob (package name `ciaobob`) — internal BCOMM performance management (monthly check-ins, quarterly reviews, OKRs/goals, manager scoring, annual roll-up).

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App Router pages | Server-rendered UI; load data via Supabase in RSC; enforce route-level access | `src/app/**/page.tsx` |
| Route handlers | OAuth callback, onboarding reset | `src/app/auth/callback/route.ts`, `src/app/onboarding/reset/route.ts` |
| Proxy (edge request) | Session refresh cookies; unauthenticated redirect; first-check-in gate | `src/proxy.ts` |
| Protected layout | Auth + onboarded check; period bootstrap; inbox badge; app chrome | `src/app/(protected)/layout.tsx` |
| Admin layout | HR_ADMIN role gate | `src/app/(protected)/admin/layout.tsx` |
| Server Actions | All app mutations; Zod validation; `revalidatePath` | `src/lib/actions/*.ts` |
| Supabase clients | SSR cookie client (server), browser client (rare) | `src/lib/supabase/server.ts`, `client.ts` |
| Domain types | Hand-maintained TS models + partial `Database` map | `src/lib/types/database.ts` |
| UI components | Feature UI + Shadcn primitives (LR tokens) | `src/components/**` |
| SQL migrations | Schema, RLS, SECURITY DEFINER RPCs | `supabase/migrations/*.sql` |
| Scheduled jobs | Email/Slack check-in reminders (bypass RLS with service role) | `netlify/functions/email-reminders.mts`, `slack-reminders.mts` |

## Pattern Overview

**Overall:** Next.js App Router monolith with **Server Components-first** data loading and **Server Actions** for mutations (no dedicated API route layer for app logic).

**Key Characteristics:**
- **Supabase as BFF:** All persistence through `@supabase/ssr` with Row Level Security; complex hierarchy and admin operations via PostgreSQL RPCs.
- **Thin client, fat server:** ~55 client components; pages are async RSC that query Supabase and pass serializable props into forms/charts.
- **Defense-in-depth auth:** `src/proxy.ts` (request interception) + `src/app/(protected)/layout.tsx` (session/profile/onboarding) + per-page checks (ownership, `org_closure` subtree).
- **No separate service layer:** Business logic lives in Server Actions and occasionally inline in large page components (e.g. `src/app/(protected)/dashboard/page.tsx`).

## Layers

**Presentation (RSC pages):**
- Purpose: Compose UI, fetch read models, redirect unauthorized users.
- Location: `src/app/`
- Contains: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`
- Depends on: `@/lib/supabase/server`, `@/components/*`, `@/lib/types/database`
- Used by: HTTP requests via App Router

**Presentation (client islands):**
- Purpose: Interactive forms (MIT arrays, mood, charts), optimistic UX with `useTransition`.
- Location: `src/components/` (feature folders + `ui/` Shadcn)
- Contains: `'use client'` components; call imported Server Actions directly.
- Depends on: Server Actions, `next/navigation`, Radix/Shadcn UI
- Used by: RSC pages as children

**Request / session (proxy):**
- Purpose: Run before route handlers; maintain Supabase auth cookies; redirect unauthenticated users; enforce first monthly check-in for employees/managers.
- Location: `src/proxy.ts` (Next.js 16 convention — replaces `middleware.ts`)
- Contains: `export async function proxy`, `export const config.matcher`
- Depends on: `@supabase/ssr`, env `NEXT_PUBLIC_SUPABASE_*`
- Used by: Next.js for matched paths

**Application / mutations (Server Actions):**
- Purpose: Validate input (Zod), authorize caller, read/write Supabase, trigger notifications, revalidate caches.
- Location: `src/lib/actions/` (one file per domain: checkins, okrs, performance, admin, etc.)
- Contains: `'use server'` functions; local `ActionResult` type per file.
- Depends on: `createClient`, `revalidatePath`, `after` (deferred notifications), `@/lib/notifications`
- Used by: Client components and occasionally RSC (inline server functions in `src/app/(protected)/admin/scores/page.tsx`)

**Data access:**
- Purpose: Typed-ish access to Postgres via Supabase JS; RLS enforces employee/manager/HR boundaries.
- Location: Server Actions, RSC pages, `src/lib/supabase/server.ts`, Netlify functions (service role)
- Contains: `.from()`, `.rpc()`, occasional `(supabase as any)` casts when generated types lag RPCs/tables.
- Depends on: Supabase hosted project, migrations in `supabase/migrations/`
- Used by: All server-side code

**Database / policy:**
- Purpose: Canonical schema, closure-table org hierarchy, SECURITY DEFINER helpers, RLS policies.
- Location: `supabase/migrations/` (32 SQL files, `00001`–`00031`)
- Contains: Tables (`profiles`, `org_closure`, `checkins`, `okrs`, `quarterly_scores`, …), RPCs (`get_subordinates`, `upsert_profile_on_login`, …)
- Depends on: Supabase Auth (`auth.users`)
- Used by: PostgREST + application clients

**Integrations (side effects):**
- Purpose: Email (Mailtrap), Slack DMs, OpenAI extraction for historical reviews.
- Location: `src/lib/notifications.ts`, `src/lib/slack.ts`, `src/lib/actions/historical-review-actions.ts`
- Depends on: env vars (`MAILTRAP_API_TOKEN`, `OPENAI_API_KEY`, workspace Slack tokens in reminder functions)
- Used by: Server Actions and Netlify cron handlers

## Data Flow

### Primary Request Path (authenticated page view)

1. **Request enters proxy** — `src/proxy.ts` refreshes session cookies via `getUser()`, redirects to `/login` if no user, optionally redirects to `/checkins` if first check-in not submitted (`src/proxy.ts:53-91`).
2. **Protected layout runs** — `src/app/(protected)/layout.tsx` re-validates user, loads/provisions `Profile` via `getOrProvisionProfile`, redirects to `/onboarding` if needed, calls `ensureCurrentPeriod()` (`src/lib/actions/period-actions.ts`), computes manager inbox count via RPCs.
3. **Page RSC executes** — e.g. `src/app/(protected)/checkins/[checkinId]/page.tsx` loads rows with `.from()` / joins, applies access rules (owner, manager subtree via `org_closure`, HR).
4. **Client island hydrates** — e.g. `EmployeeCheckinForm` receives props; user edits local state (`useState` for MIT arrays per project conventions).
5. **Render** — `StandardLayout` wraps page with `Header` + role-aware `Sidebar` (`src/components/layout/StandardLayout.tsx`).

### Mutation Path (form submit)

1. **Client invokes Server Action** — e.g. `upsertCheckinEmployee(formData)` from `src/components/checkins/EmployeeCheckinForm.tsx` inside `startTransition`.
2. **Action authenticates** — `getCallerProfile()` or inline `getUser()` + `profiles` row (`src/lib/actions/checkin-actions.ts:19-25`).
3. **Zod parses FormData** — JSON-stringified MIT fields parsed with nested schemas (`src/lib/actions/checkin-actions.ts:47-80`).
4. **Supabase write** — upsert into `checkins` / related tables; RLS must allow row.
5. **Side effects** — `after()` schedules emails (`notifyManagerCheckinSubmitted`, etc. in `src/lib/notifications.ts`); auto-carry `next_mits` to following month on submit.
6. **Cache invalidation** — `revalidatePath('/checkins')`, client `router.refresh()`.

### Auth / onboarding path

1. User submits magic link on `src/app/login/page.tsx` → Supabase Auth email flow.
2. **`GET /auth/callback`** — `src/app/auth/callback/route.ts` exchanges code, enforces `isAllowedEmail` (`src/lib/auth/allowed-domains.ts`), calls `upsert_profile_on_login` RPC.
3. Redirect to `/dashboard` or `next` param; protected layout sends non-onboarded users to `src/app/onboarding/page.tsx`.
4. Onboarding actions in `src/lib/actions/onboarding-actions.ts` set manager relationship and `is_onboarded`.

### Scheduled reminders (outside request path)

1. Netlify cron invokes `netlify/functions/email-reminders.mts` or `slack-reminders.mts` (`netlify.toml` schedules `0 9 * * *`).
2. Uses `@supabase/supabase-js` with **service role** (not RLS-scoped user session).
3. Shared date logic in `src/lib/reminder-logic.ts`; sends via `src/lib/notifications.ts` / `src/lib/slack.ts`.

**State Management:**
- **Server:** No global server store; data fetched per request in RSC. `revalidatePath` invalidates Next cache after mutations.
- **URL:** `nuqs` adapter in root layout (`src/app/layout.tsx`) for typed search params where used (quarter filters, tabs).
- **Client:** Local `useState` / `useTransition` in forms; **Zustand is listed in `package.json` but not used** in `src/` — do not introduce global client stores for server data.

## Key Abstractions

**Profile + roles:**
- Purpose: Authenticated user identity and authorization tier (`EMPLOYEE` | `MANAGER` | `HR_ADMIN`).
- Examples: `src/lib/types/database.ts` (`Profile`), enforced in layouts and actions.
- Pattern: Load once per layout or action via `profiles` table; HR routes add `src/app/(protected)/admin/layout.tsx` gate.

**Org hierarchy (`org_closure`):**
- Purpose: Materialized closure table for manager/report relationships and subtree queries.
- Examples: Manager page access `src/app/(protected)/checkins/[checkinId]/page.tsx:55-60`; RPC `get_subordinates` across dashboard/team/inbox.
- Pattern: Prefer `.rpc('get_subordinates', { manager_uuid })` over ad-hoc recursive queries in TS.

**Performance period:**
- Purpose: Quarterly calendar container for check-ins, OKRs, and scores.
- Examples: `ensureCurrentPeriod()` in protected layout; `performance_periods` table.
- Pattern: Open period drives "current quarter" UX; auto-created/advanced in `src/lib/actions/period-actions.ts`.

**Check-in v2 (monthly / quarterly):**
- Purpose: Two-tab employee workflows (review MITs/goals → plan next period); JSONB `mits`, `next_mits`, `goals`, `value_assessments`.
- Examples: `src/lib/actions/checkin-actions.ts`, `src/lib/actions/quarterly-checkin-actions.ts`; UI `src/components/checkins/*`.
- Pattern: Client `useState` arrays → Server Action → Zod → Supabase; auto-carry on submit documented in project conventions.

**ActionResult:**
- Purpose: Discriminated union for mutation outcomes without throwing for validation errors.
- Examples: `{ success: true; id?: string } | { error: string }` repeated per action file.
- Pattern: Return errors to client; display in form state — not `next-safe-action` despite stack docs mentioning it elsewhere.

## Entry Points

**HTTP pages (App Router):**
- Location: `src/app/**/page.tsx` (30+ routes under `(protected)`, plus `login`, `onboarding`, root redirect).
- Triggers: User navigation.
- Responsibilities: Read-heavy RSC; role-specific dashboards (`src/app/(protected)/dashboard/page.tsx`), CRUD surfaces for check-ins/OKRs/team/scoring.

**Route handlers:**
- Location: `src/app/auth/callback/route.ts`, `src/app/onboarding/reset/route.ts`
- Triggers: OAuth redirect, onboarding reset link.
- Responsibilities: Session exchange, domain whitelist, profile provisioning.

**Proxy:**
- Location: `src/proxy.ts`
- Triggers: All non-static routes per `config.matcher`.
- Responsibilities: Auth cookie refresh, login redirect, first-check-in gate.

**Server Actions:**
- Location: `src/lib/actions/*.ts` (14 modules)
- Triggers: Form submission / button handlers from client components.
- Responsibilities: All write paths; only sanctioned mutation API.

**Netlify functions:**
- Location: `netlify/functions/email-reminders.mts`, `slack-reminders.mts`
- Triggers: Cron + optional `REMINDER_SECRET` header.
- Responsibilities: Batch reminder delivery with service-role DB access.

## Architectural Constraints

- **Threading:** Node.js server runtime per request (RSC + Server Actions + proxy default in Next 16); no worker threads. Cron functions are isolated Netlify invocations.
- **Global state:** No in-process shared mutable app state. Session is cookie-backed Supabase JWT. Each request creates a fresh `createClient()` from `cookies()`.
- **No REST API layer:** Do not add `src/app/api/**` routes for domain logic — stack standard is Server Actions only (existing route handlers are auth/onboarding only).
- **RLS required:** Application must assume anon/authenticated clients cannot bypass Postgres policies; service role only in scheduled functions.
- **Internal-only:** Google/magic-link auth via Supabase; domain whitelist at callback (`src/lib/auth/allowed-domains.ts`).
- **Dynamic rendering:** Protected pages overwhelmingly set `export const dynamic = 'force-dynamic'` — no static auth pages.

## Anti-Patterns

### Duplicated authorization in proxy, layout, and pages

**What happens:** `src/proxy.ts`, `src/app/(protected)/layout.tsx`, and individual pages all re-fetch `profiles` and apply redirects.
**Why it's wrong:** Drift risk — a new route under `(protected)` might assume proxy enforced onboarding when only layout does consistently.
**Do this instead:** Treat layout as canonical for profile/onboarding; use page-level checks only for resource ownership (pattern in `src/app/(protected)/checkins/[checkinId]/page.tsx`). Keep proxy limited to session + global gates.

### `(supabase as any)` at call sites

**What happens:** Widespread eslint-suppressed casts for RPCs and tables not fully reflected in `Database` (`src/app/(protected)/dashboard/page.tsx`, most actions).
**Why it's wrong:** Loses compile-time safety; hides schema drift between `src/lib/types/database.ts` and migrations.
**Do this instead:** Extend `Database['public']['Functions']` and table types when adding RPCs; reserve casts to rare edge cases.

### Large RSC pages with inline queries

**What happens:** `src/app/(protected)/dashboard/page.tsx` and `src/app/(protected)/team/[employeeId]/page.tsx` contain extensive sequential Supabase queries in one file.
**Why it's wrong:** Hard to test, reuse, or optimize; blurs page vs data-access responsibilities.
**Do this instead:** Extract read helpers colocated under `src/lib/` (e.g. `src/lib/queries/dashboard.ts`) when adding new data — keep pages as orchestration only.

### Per-file `ActionResult` duplication

**What happens:** Each `src/lib/actions/*.ts` redefines identical `ActionResult` type.
**Why it's wrong:** Inconsistent evolution if one file adds fields others lack.
**Do this instead:** Add shared `src/lib/actions/types.ts` when touching actions — single exported union.

## Error Handling

**Strategy:** Server Actions return `{ error: string }` for expected failures (validation, auth, RLS); unexpected Supabase errors logged with `console.error` and mapped to user-safe messages. Route handlers redirect with query `error` codes (`src/app/login/page.tsx`). RSC uses `redirect()`, `notFound()` from `next/navigation`.

**Patterns:**
- Early return guards: `if (!caller) return { error: 'Not authenticated' }` in actions.
- Zod `safeParse` → first issue message to client.
- `src/app/(protected)/error.tsx` client boundary for render failures.
- Notifications fail open: missing `MAILTRAP_API_TOKEN` no-ops (`src/lib/notifications.ts:19-26`).

## Cross-Cutting Concerns

**Logging:** `console.log` / `console.error` with prefixed tags (`[dashboard]`, `[notifications]`, `[auth/callback]`). No centralized logger or Sentry.

**Validation:** Zod 4 in Server Actions; check-in MIT arrays JSON-parsed from `FormData`. Some admin forms use React Hook Form + Shadcn `Form` (`src/components/ui/form.tsx`).

**Authentication:** Supabase SSR magic link / OAuth; `getUser()` only (never `getSession()` in proxy). Profile provisioning via RPC + fallback insert in `src/lib/supabase/server.ts`. Domain check on callback, not on every provision path.

**Authorization:** Postgres RLS + application checks (role, `org_closure` depth, row ownership). HR admin via separate layout.

**Styling:** Tailwind v4 + LR design tokens in `src/app/globals.css`; Shadcn components under `src/components/ui/`.

**Email / Slack / AI:** Optional env-gated integrations; never block core DB writes on notification failure (use `after()` where applicable).

---

*Architecture analysis: 2026-06-04*
