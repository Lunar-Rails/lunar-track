---
last_mapped_commit: 804cf743d1651aa9bd1d761c60c4d1478e38a540
---

# Coding Conventions

**Analysis Date:** 2026-06-04

## Naming Patterns

**Files:**
- React components: PascalCase — `EmployeeCheckinForm.tsx`, `MitPlanList.tsx` in `src/components/<domain>/`
- Server actions: kebab-case with `-actions` suffix — `checkin-actions.ts`, `performance-actions.ts` in `src/lib/actions/`
- Pure utilities / domain logic: kebab-case — `reminder-logic.ts`, `allowed-domains.ts` in `src/lib/`
- App Router pages: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` inside route folders — e.g. `src/app/(protected)/checkins/page.tsx`
- Route handlers: `route.ts` — e.g. `src/app/auth/callback/route.ts`
- Shared types: single file `src/lib/types/database.ts`
- Constants: kebab-case in `src/lib/constants/` — `scores.ts`, `mood.ts`
- Netlify functions: kebab-case — `netlify/functions/slack-reminders.mts`

**Functions:**
- camelCase for all functions — `upsertCheckinEmployee`, `getOrProvisionProfile`, `buildFormData`
- Event handlers prefixed with `handle` or `on` — `handleLinkChange`, `onSubmit`, `saveAndAdvance`
- Private helpers in the same file: camelCase, no underscore prefix — `getCallerProfile`, `initReviewMits`, `emptyPlanMit`
- Server actions exported as named async functions — never default-export actions

**Variables:**
- camelCase for locals and state — `reviewMits`, `isPending`, `serverError`
- SCREAMING_SNAKE for module-level constants — `MONTH_NAMES`, `GATE_EXEMPT_PREFIXES`, `APP_URL` in `src/lib/notifications.ts`
- Database column names stay snake_case in payloads and types — `employee_id`, `okr_id`, `done_well`

**Types:**
- Domain entities: `interface` in `src/lib/types/database.ts` — `Profile`, `Checkin`, `Okr`
- Union aliases: `type` — `UserRole`, `MoodEnergy`, `ReminderType` in `src/lib/reminder-logic.ts`
- Component props: `interface <ComponentName>Props` — `EmployeeCheckinFormProps`, `MitPlanListProps`
- Form inferred types: `type FormValues = z.infer<typeof schema>` — see `src/components/performance/AnnualScoreForm.tsx`
- Server action results: local `type ActionResult = { success: true; id?: string } | { error: string }` duplicated per actions file (not yet centralized)

## Code Style

**Formatting:**
- No Prettier config detected — formatting is implicit via ESLint + editor defaults
- Semicolons: omitted in application code (`src/app/`, `src/components/`, `src/lib/`); present in some Shadcn UI primitives (`src/components/ui/select.tsx`) and `next.config.ts`
- Quotes: single quotes in app/lib code; double quotes in Shadcn UI files under `src/components/ui/`
- Trailing commas: used in multiline objects/arrays
- TypeScript `strict: true` in `tsconfig.json`

**Linting:**
- Tool: ESLint 9 flat config — `eslint.config.mjs`
- Extends: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Run: `npm run lint`
- Common suppressions: `// eslint-disable-next-line @typescript-eslint/no-explicit-any` before Supabase queries cast to `any` (throughout `src/lib/actions/` and server pages)
- React hooks: occasional `eslint-disable-line react-hooks/exhaustive-deps` for intentional one-shot effects — `src/components/checkins/EmployeeCheckinForm.tsx`

## Import Organization

**Order:**
1. `'use client'` or `'use server'` directive (when present) — first line
2. React / Next.js — `import { useState } from 'react'`, `import { redirect } from 'next/navigation'`
3. Third-party packages — `@supabase/ssr`, `zod`, `lucide-react`, `date-fns`
4. Internal aliases (`@/…`) — components, lib, types
5. Type-only imports last within each group — `import type { Checkin } from '@/lib/types/database'`

**Path Aliases:**
- `@/*` → `./src/*` defined in `tsconfig.json`
- Always use `@/` for cross-directory imports; avoid relative `../../` beyond sibling files

**Examples to follow:**
- Server action: `src/lib/actions/checkin-actions.ts` — `'use server'` → supabase → next/cache → zod → types → notifications
- Client form: `src/components/checkins/EmployeeCheckinForm.tsx` — `'use client'` → react → next/navigation → ui → local components → actions → types

## Module Boundaries

**`'use server'`:**
- All mutation logic lives in `src/lib/actions/*.ts` — 13 action modules
- Each file starts with `'use server'` and exports named async functions
- No API route handlers for app business logic (except auth callback and onboarding reset)

**`'use client'`:**
- Required on interactive components: forms, charts, nav, theme, admin tables
- Server Components (default) for pages that fetch data — e.g. `src/app/(protected)/dashboard/page.tsx`, `src/app/(protected)/checkins/page.tsx`
- Protected layout is a Server Component — `src/app/(protected)/layout.tsx` with `export const dynamic = 'force-dynamic'`

**Component exports:**
- Page and feature components: `export default function ComponentName` — dominant pattern (~60 files)
- Shared helpers / lib functions: named exports — `export function cn` in `src/lib/utils.ts`, `export function getMonthEnd` in `src/lib/reminder-logic.ts`
- UI primitives: named exports — `export { Select, SelectContent, … }` from `src/components/ui/select.tsx`
- No barrel `index.ts` re-export files detected

## Server Actions

**Signature:**
- Accept `FormData` for form submissions or typed primitives for simple mutations
- Return `Promise<ActionResult>` — never throw for expected validation/auth failures

**ActionResult pattern:**
```typescript
type ActionResult = { success: true; id?: string } | { error: string }
```

**Validation flow** (follow `src/lib/actions/checkin-actions.ts`):
1. `createClient()` from `src/lib/supabase/server`
2. `getCallerProfile()` or inline auth check — early `return { error: 'Not authenticated' }`
3. Parse `FormData` with inline `z.object({…}).safeParse(…)`
4. Parse JSON-stringified array fields with nested Zod schemas — `review_mits`, `next_mits`, `goals`, etc.
5. Business-rule guards — period open, ownership, duplicate submit
6. Supabase write via `(supabase as any).from(…)` 
7. `revalidatePath('/…')` for affected routes
8. Side effects (notifications) in `after(async () => { … })` from `next/server` — non-blocking
9. `return { success: true, id?: string }`

**Client consumption:**
```typescript
const result = await upsertCheckinEmployee(formData)
if ('error' in result) setError(result.error)
else { /* success */ }
```
See `src/components/checkins/EmployeeCheckinForm.tsx`.

## Forms

**Check-in forms (monthly + quarterly):**
- Use plain `useState` for controlled array fields (MIT lists) — not React Hook Form
- Serialize arrays to JSON strings in `FormData` — `fd.append('review_mits', JSON.stringify(reviewMits.filter(…)))`
- Two-tab wizard: `'review' | 'plan'` step state; auto-save draft on tab advance
- Reference: `src/components/checkins/EmployeeCheckinForm.tsx`, `src/components/checkins/QuarterlyCheckinEmployeeForm.tsx`

**Simple CRUD forms:**
- `useState` + native `<form onSubmit>` — `src/components/okrs/OkrForm.tsx`

**Scored / validated forms:**
- React Hook Form + `@hookform/resolvers/zod` + Zod schema
- Still submit via `FormData` to server actions (not direct JSON POST)
- Reference: `src/components/performance/AnnualScoreForm.tsx`

**Shadcn Form primitives:**
- Available in `src/components/ui/form.tsx` — use when adopting RHF with Shadcn field wrappers

## Validation

**Library:** Zod 4 — import from `"zod"`

**Server-side:**
- Define schemas inline in action functions or at module top
- Use `.safeParse()` and return first issue message: `parsed.error.issues[0]?.message ?? 'Invalid input'`
- JSON array fields: `z.array(subSchema).parse(JSON.parse(raw))` inside try/catch → `{ error: 'Invalid MITs format' }`

**Client-side:**
- Minimal client validation (required title checks) — defer to server for authoritative rules
- RHF + zodResolver where RHF is used

## Error Handling

**Patterns:**
- Server actions: return `{ error: string }` — do not throw for user-facing validation failures
- Auth failures: early return `{ error: 'Not authenticated' }` or page-level `redirect('/login')`
- Supabase errors: check `{ error }` destructuring; map to user message or log + generic error
- Unexpected errors in pages: `src/app/(protected)/error.tsx` client boundary logs via `console.error(error)`
- Notification / email failures: catch, log, do not fail the primary mutation — `.catch((err) => console.error('[checkin-actions] notification failed:', err))`
- External I/O graceful degradation: `src/lib/notifications.ts` no-ops when `MAILTRAP_API_TOKEN` is unset

**Do not:**
- Use try/catch around entire server actions for control flow
- Surface raw Supabase/PostgREST error strings to users without sanitizing

## Logging

**Framework:** `console.log` / `console.error` / `console.warn` — no structured logger

**Patterns:**
- Bracketed module prefix — `[checkin-actions]`, `[slack]`, `[notifications]`, `[supabase/server]`
- Log on failure paths and dev no-op paths; avoid verbose success logging in production
- Server pages log fetch errors inline — `if (checkinsErr) console.error('[checkins] fetch failed:', checkinsErr.message)` in `src/app/(protected)/checkins/page.tsx`

## Comments

**When to Comment:**
- Module-level JSDoc for pure logic modules — `src/lib/reminder-logic.ts`, `src/lib/notifications.ts`
- Non-obvious business rules — reminder window logic, first-check-in gate in `src/proxy.ts`
- Supabase workarounds — schema cache cold start fallback in `src/lib/supabase/server.ts`

**JSDoc/TSDoc:**
- Used on exported pure functions in `src/lib/reminder-logic.ts`
- Not used on React components or server actions

## Styling & UI

**Design system:** LR tokens mandatory — `lr-*` CSS custom properties in `src/app/globals.css`

**Tailwind usage:**
- Background/surface: `bg-lr-bg`, `bg-lr-glass`, `border-lr-border`, `text-lr-text`, `text-lr-muted`
- Typography: `font-sans` (Inter body), display via `--font-display` (Space Grotesk)
- Glass cards: `rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass`

**Shadcn/Radix:**
- Components live in `src/components/ui/` — owned, not node_modules
- Dropdown convention: `SelectContent` must use `side="bottom" position="popper" sideOffset={4}` and `className="bg-lr-bg border-lr-border shadow-lg"` — see `src/components/checkins/MitPlanList.tsx`
- Select items: `pl-3 pr-8` for left-aligned text

**Class merging:** use `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge)

## Data Access

**Supabase clients:**
- Server: `createClient()` in `src/lib/supabase/server.ts` — cookie-backed SSR
- Browser: `createClient()` in `src/lib/supabase/client.ts`
- Service role: only in Netlify functions — `netlify/functions/slack-reminders.mts`

**Typing workaround:**
- Generated `Database` type in `src/lib/types/database.ts` is partial; queries use `(supabase as any).from(…)` with explicit casts on results
- When adding tables/columns, update `src/lib/types/database.ts` and continue the cast pattern until types are regenerated

**Auth:**
- Always `supabase.auth.getUser()` — never `getSession()` alone (see comment in `src/proxy.ts`)
- Profile provisioning: `getOrProvisionProfile()` in `src/lib/supabase/server.ts`

## Domain Terminology

**User-facing vs internal:**
- UI label "Goal" — internal fields remain `okr_id`, `okr_label`, `okrs_stretch_goals` (no migration)
- "MIT" for monthly improvement tasks — stored as JSON arrays `mits`, `next_mits`
- Company values: chip multi-select in quarterly check-ins — `value_assessments`

## Function Design

**Size:** Server actions can be long (200–400 lines) with inline schemas; extract pure helpers to `src/lib/` when testable (see `reminder-logic.ts` pattern)

**Parameters:** Prefer `FormData` for multi-field mutations; use typed params for simple ID-based actions — `reopenCheckin(checkinId: string)`

**Return Values:** Always discriminated union — check `'error' in result` on client; `'success' in result` is implicit when no error key

## Async & Side Effects

**Transitions:** Wrap server action calls in `useTransition` — `startTransition(async () => { … })`

**Cache invalidation:** `revalidatePath('/checkins')` after mutations in action files

**Deferred work:** `after()` from `next/server` for notifications and MIT carry-forward — `src/lib/actions/checkin-actions.ts`

**Navigation:** `router.refresh()` after save; `router.push()` on create success — client components

## State Management

**Server data:** Fetched in Server Components / pages — no TanStack Query

**Client UI state:** `useState`, `useTransition`, URL search params (`useSearchParams` in forms)

**Global client state:** `zustand` is a dependency but not used in `src/` — do not introduce Zustand unless a cross-cutting client need emerges

**URL state:** `nuqs` adapter wired in `src/app/layout.tsx` — `NuqsAdapter`; use `useQueryState` for filters/tabs when needed

---

*Convention analysis: 2026-06-04*
