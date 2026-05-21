<!-- GSD:project-start source:PROJECT.md -->
## Project

**LunarTrack**

LunarTrack is an internal performance management tool for BCOMM employees. It enables structured monthly check-ins and quarterly OKR reviews between managers and their reports, tracks performance across three dimensions (professional mastery, OKRs, and behaviours/values), and surfaces a manager-driven 1–5 quarterly rating that aggregates into an annual performance score.

**Core Value:** A manager can complete a full performance cycle — check-ins, quarterly scoring, and annual review — for every direct report, with all context in one place.

### Constraints

- **Tech stack**: Next.js 15 App Router, TypeScript, Tailwind CSS + LR Design System, Shadcn/Radix, Supabase (auth + database), Server Actions (no API routes for app logic), React Hook Form + Zod, Zustand — matches BCOMM approved stack and Flux architecture
- **Auth**: Supabase SSR + Google OAuth only — no username/password, no NextAuth
- **Internal only**: Not a public product; no external APIs, no customer data
- **Design system**: LR Design System (dark glass aesthetic, violet accent, Space Grotesk + Inter, lr-* tokens) — mandatory for all UI
- **Data retention**: Any tool storing operational data long-term requires a retention policy (per vibe-coding guidelines)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | **16.2.4** | App framework | Current stable release (Oct 2025). Turbopack is now the default bundler — 50%+ faster builds. React Compiler support is stable. **Note:** PROJECT.md specifies "Next.js 15" but v16 is the production standard as of April 2026. Upgrade path is straightforward via codemod. |
| React | **19.2** | UI runtime | Ships with Next.js 16. Required for server components, useActionState, and View Transitions. |
| TypeScript | **5.x** | Type safety | Minimum required by Next.js 16. Strict mode on from day one — catches hierarchy traversal bugs early. |
### Authentication
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@supabase/supabase-js` | **2.104.0** | Supabase client | Core client with all auth, database, and storage APIs. |
| `@supabase/ssr` | **0.10.2** | SSR cookie handling | Replaces deprecated `@supabase/auth-helpers-*`. The ONLY supported pattern for Next.js App Router + Supabase auth. Provides `createServerClient` and `createBrowserClient`. |
### Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase PostgreSQL | Managed | Primary data store | Confirmed by BCOMM IT. All structured data: users, org hierarchy, check-ins, OKRs, scores. |
| Supabase RLS | Built-in | Row-level access control | Enforces the three-tier access model (Employee / Manager / HR Admin) at the database layer, not just application layer. Defense in depth. |
### UI
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | **4.2.4** | Styling | CSS-first configuration (no `tailwind.config.ts`). All config in the main CSS file via `@theme`. Shadcn/ui now defaults to v4. |
| Shadcn/ui | **latest CLI** (`shadcn@0.9.5`) | Component library | Copy-paste components built on Radix primitives. Fully compatible with Tailwind v4 and React 19. Components are owned in the codebase — no version lock-in, full customisation for the LR Design System tokens. |
| Radix UI | Peer dep of Shadcn | Headless primitives | Accessibility and ARIA handled by Radix. Do not use Radix directly; consume via Shadcn components. |
| LR Design System | Workspace package | Brand tokens | **Mandatory.** Dark glass aesthetic, violet accent (`lr-violet-*`), Space Grotesk (headings) + Inter (body), `lr-*` CSS custom properties. All Shadcn component overrides must use LR tokens, not Tailwind defaults. |
### Forms
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React Hook Form | **7.73.1** | Form state management | Uncontrolled input model — no re-render on every keystroke. Essential for long check-in forms (8–12 fields). Integrates cleanly with Server Actions via `handleSubmit` → action. |
| `@hookform/resolvers` | **5.2.2** | Schema bridge | Connects Zod schemas to RHF's validation pipeline. One schema, enforced on both client and server. |
| Zod | **4.3.6** | Schema validation | **Use Zod 4.** Breaking changes from v3: error customisation API changed, `._def` moved to `._zod.def`. New features: faster parse, better TypeScript inference. Import from `"zod"` (v4 is now the package root). |
### State Management
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | **5.0.12** | Client state | Minimal global state — session user, active employee context for manager views, UI drawer/modal state. **Do not use Zustand for server data** — that comes from Server Components or Server Actions directly. |
| nuqs | **2.8.9** | URL state | Type-safe `useQueryState` for search params. Use for: active quarter filter, selected employee in hierarchy view, active tab in dashboard. Matches Flux production architecture. Prevents stale URL state bugs. Wraps root layout in `NuqsAdapter`. |
- `useSessionStore` — current user (id, role, managerId) hydrated from Supabase session
- `useUIStore` — modal/sheet open states, toast queue
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | `^4.x` | Date manipulation | Quarter boundary calculations (Q1–Q4), check-in period labels, annual roll-up logic. Prefer over `dayjs` — tree-shakeable, TypeScript-native. |
| `@tanstack/react-table` | `^8.x` | Data tables | Manager's all-reports view, HR Admin employee roster. Only for tables with sorting/filtering — do not use for simple lists. |
## Alternatives Considered and Rejected
| Category | Recommended | Rejected | Why Rejected |
|----------|-------------|----------|--------------|
| Auth | Supabase SSR + Google OAuth | NextAuth | Previous LunarTrack used NextAuth. Rejected: adds dependency, session model mismatches Supabase RLS `auth.uid()` calls, Flux prod uses Supabase SSR |
| Database client | Supabase JS client | Prisma | Previous LunarTrack used Prisma. Rejected: Supabase client works directly with RLS and `auth.uid()`; Prisma requires service role key which bypasses RLS entirely, making per-user security policies impossible without application-layer duplication |
| State | Zustand | React Query / TanStack Query | Overkill for this app. Server Components handle most data fetching. TanStack Query is valuable when you need client-side cache invalidation patterns — this app's mutation volume does not justify the complexity. |
| Forms | React Hook Form | Formik | Formik re-renders on every keystroke; RHF uses uncontrolled inputs. Performance difference is measurable on 8+ field check-in forms. |
| Styling | Tailwind v4 + Shadcn | CSS Modules, styled-components | Flux production uses this stack. Consistency with production reduces cognitive switching cost for IT & Design maintainers. |
| URL state | nuqs | Manual `useSearchParams` | Manual approach requires parsing, type-casting, and serialisation by hand. nuqs provides typed parsers, batched History API updates, and SSR-safe access in Server Components. |
| ORM | Supabase client + raw SQL via `rpc()` | Drizzle ORM | Drizzle is a strong alternative but adds a build step. For a small internal tool with a stable schema, the Supabase client + typed `rpc()` calls for complex queries (recursive hierarchy) is simpler and directly supports RLS. Reconsider if schema complexity grows significantly. |
## Installation
# Core framework
# Supabase auth
# UI: install Shadcn CLI and init, then add components individually
# tailwindcss is pulled in automatically by Shadcn init
# Forms and validation
# State
# Supporting
# Dev dependencies
## Environment Variables
# .env.local
# Legacy anon key format (NEXT_PUBLIC_SUPABASE_ANON_KEY) is being deprecated
## Key File Conventions (Next.js 16 + Supabase SSR)
## Sources
- Supabase SSR Next.js guide: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase client creation patterns: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Google OAuth setup: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Hierarchical data in Supabase: https://dev.to/roel_peters_8b77a70a08fdb/beyond-flat-tables-model-hierarchical-data-in-supabase-with-recursive-queries-4ndl
- Next.js 16 upgrade guide: https://nextjs.org/docs/app/guides/upgrading/version-16
- Next.js 16 release blog: https://nextjs.org/blog/next-16
- Shadcn Tailwind v4 guide: https://ui.shadcn.com/docs/tailwind-v4
- React Hook Form + Server Actions: https://markus.oberlehner.net/blog/using-react-hook-form-with-react-19-use-action-state-and-next-js-15-app-router
- nuqs: https://nuqs.dev
- Zod v4 release: https://zod.dev/v4
- npm registry (versions verified 2026-04-21): @supabase/ssr@0.10.2, @supabase/supabase-js@2.104.0, next@16.2.4, zustand@5.0.12, react-hook-form@7.73.1, zod@4.3.6, nuqs@2.8.9, tailwindcss@4.2.4, @hookform/resolvers@5.2.2
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

### Check-in v2 Model

#### Monthly Check-in (two-section layout)

**Section 1 — Review**
- `mits: ReviewMit[]` — carried from prior month's `next_mits` (or quarterly `next_quarter_mits` for the first month of a quarter). Each MIT has: `title`, `description`, `okr_id | null`, `okr_label | null`, `status: 'achieved' | 'not_achieved'`.
- Employee can add extra MITs with the "+ Add MIT" button.
- `done_well: string` and `do_differently: string` — free-text fields.

**Section 2 — Next Month**
- `next_mits: PlanMit[]` — MITs the employee plans for the coming month. Each MIT has: `title`, `description`, `okr_id | null`, `okr_label | null` (no status).
- OKR link dropdown shows the employee's active quarterly OKRs plus "Unrelated to quarterly OKRs" option.
- **Auto-carry:** on submit, `next_mits` are written as `mits` (status `not_achieved`) into the following month's check-in draft.

**Key types:**
```typescript
interface ReviewMit { title: string; description: string; okr_id: string | null; okr_label: string | null; status: 'achieved' | 'not_achieved' }
interface PlanMit    { title: string; description: string; okr_id: string | null; okr_label: string | null }
```

**Key components:** `MitReviewList` (achieved/not-achieved toggle pills, stacked vertically), `MitPlanList` (OKR link dropdown, always opens downward).

---

#### Quarterly Check-in (two-section layout)

**Section 1 — Review**
- `goals: QuarterlyGoalReview[]` — carried from previous quarter's `next_quarter_goals`. Each goal: `id`, `title`, `description`, `status: 'achieved' | 'not_achieved' | null`.
- Done well / Done differently — read-only panel auto-aggregated from the 3 monthly check-ins of the quarter (`MonthlyDoneWellSummary` component, labelled by month).
- `value_assessments: ValueAssessment[]` — employee selects which company values they demonstrated (chip multi-select) and writes a short description per value. No numeric rating.

**Section 2 — Next Quarter**
- `next_quarter_goals: QuarterlyGoal[]` — simple goals (no OKR system), each with `id` (uuid), `title`, `description`.
- `next_quarter_mits: PlanMit[]` — MITs for the first month of the new quarter. OKR link dropdown is populated from `next_quarter_goals` (not the OKR table).
- **Auto-carry:** on submit, `next_quarter_goals` seeds next quarter's `goals`; `next_quarter_mits` seeds the first monthly check-in of the new quarter.

**Key types:**
```typescript
interface QuarterlyGoal       { id: string; title: string; description: string }
interface QuarterlyGoalReview { id: string; title: string; description: string; status: 'achieved' | 'not_achieved' | null }
interface ValueAssessment     { value_id: string; value_name: string; description: string }
```

**Key components:** `GoalAchievementList`, `MonthlyDoneWellSummary`, `ValueChipSelector`, `MitPlanList` (goal link).

---

#### Dropdown UI conventions
- All `SelectContent` must use `side="bottom" position="popper" sideOffset={4}` to force downward opening.
- Background override: `className="bg-[#13111f] border border-white/10 shadow-2xl backdrop-blur-none"` — the glass design system's `bg-popover` token is semi-transparent and blends with the page.
- Items use `pl-3 pr-8` padding for left-aligned text.

#### Forms
- Monthly and quarterly employee check-in forms use plain `useState` (not React Hook Form) — the MIT list is a controlled array of objects, which RHF's field-array API handles poorly with nested nullable fields.
- Server Actions receive MIT arrays as JSON-stringified form fields (`review_mits`, `next_mits`, etc.) and parse them with Zod.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
