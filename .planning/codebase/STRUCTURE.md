---
last_mapped_commit: 804cf743d1651aa9bd1d761c60c4d1478e38a540
---

# Codebase Structure

**Analysis Date:** 2026-06-04

## Directory Layout

```
lunar-track/
├── src/                          # Application source (Next.js App Router)
│   ├── app/                      # Routes, layouts, global CSS
│   ├── components/               # React UI (feature + ui primitives)
│   ├── lib/                      # Server actions, Supabase, types, helpers
│   └── proxy.ts                  # Next.js 16 request proxy (auth / gates)
├── supabase/
│   └── migrations/               # PostgreSQL schema, RLS, RPCs (00001–00031)
├── netlify/
│   └── functions/                  # Scheduled email/Slack reminder handlers
├── public/                       # Static assets (favicons, OG image, icons)
├── scripts/                      # Deploy helpers (e.g. netlify-build.sh)
├── docs/                         # Design notes and superpowers plans (reference)
├── .planning/                    # GSD planning artifacts (not runtime)
├── components.json               # Shadcn CLI config (aliases, Tailwind entry)
├── next.config.ts                # Next config (minimal)
├── netlify.toml                  # Netlify build, functions, cron schedules
├── package.json                  # deps: next 16, supabase, zod, vitest
├── tsconfig.json                 # @/* path alias → ./src/*
├── eslint.config.mjs
├── postcss.config.mjs
└── .env.example                  # Documented env var names (no secrets)
```

## Directory Purposes

**`src/app/`:**
- Purpose: File-system routing for pages, layouts, and route handlers.
- Contains: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`, `globals.css`.
- Key files: `src/app/layout.tsx` (root fonts, ThemeProvider, NuqsAdapter), `src/app/(protected)/layout.tsx` (auth shell), `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`.

**`src/components/`:**
- Purpose: Reusable UI; feature folders mirror product domains.
- Contains: Client and server-safe components; Shadcn copies in `ui/`.
- Key files: `src/components/layout/StandardLayout.tsx`, `src/components/checkins/EmployeeCheckinForm.tsx`, `src/components/ui/button.tsx`.

**`src/lib/`:**
- Purpose: Server-side logic shared across routes (no `src/services/` layer).
- Contains: `actions/`, `supabase/`, `types/`, `auth/`, `constants/`, integration helpers.
- Key files: `src/lib/supabase/server.ts`, `src/lib/types/database.ts`, `src/lib/actions/checkin-actions.ts`, `src/lib/notifications.ts`.

**`supabase/migrations/`:**
- Purpose: Versioned SQL for tables, indexes, RLS, and RPCs.
- Contains: Sequential `000NN_*.sql` files applied via `npm run supabase:push`.
- Key files: `00001_foundation.sql` (profiles, org_closure, periods), `00011_checkin_v2.sql`, `00025_security_fixes.sql`.

**`netlify/functions/`:**
- Purpose: Background jobs outside the Next.js request lifecycle.
- Contains: `.mts` handlers importing shared logic from `src/lib/`.
- Key files: `email-reminders.mts`, `slack-reminders.mts`.

**`public/`:**
- Purpose: Static files served as-is.
- Contains: Favicons, `og-image.png`, brand SVGs.

**`docs/`:**
- Purpose: Human-written specs and implementation plans (not imported by app).
- Contains: `docs/superpowers/specs/`, `docs/superpowers/plans/`, `docs/slack-reminders-setup.md`.

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Root redirect to `/dashboard` or `/login`.
- `src/proxy.ts`: Pre-handler auth and first-check-in gate (Next.js 16 proxy convention).
- `src/app/auth/callback/route.ts`: Post-login session + profile provisioning.
- `netlify/functions/email-reminders.mts`: Daily email reminder cron.

**Configuration:**
- `next.config.ts`: Next.js settings.
- `tsconfig.json`: Strict TS; path alias `@/*` → `./src/*`.
- `components.json`: Shadcn paths (`@/components`, `@/lib/utils`).
- `netlify.toml`: Build command, function schedules, Next plugin.
- `eslint.config.mjs`: ESLint 9 flat config.
- `postcss.config.mjs`: Tailwind v4 PostCSS pipeline.
- `.env.example`: Required public Supabase vars and optional integrations.

**Core Logic:**
- `src/lib/actions/*.ts`: All mutation entry points (14 modules).
- `src/lib/supabase/server.ts`: `createClient()`, `getOrProvisionProfile()`.
- `src/lib/types/database.ts`: Domain interfaces and partial Supabase `Database` type.
- `src/lib/reminder-logic.ts`: Pure date/window helpers for cron jobs.
- `src/lib/auth/allowed-domains.ts`: Email domain whitelist for login.

**Testing:**
- `src/lib/__tests__/reminder-logic.test.ts`: Vitest unit tests (only test file in repo).
- `package.json` scripts: `npm test` / `npm run test:watch` (Vitest).

## App Router Map (`src/app/`)

| Route prefix | Purpose | Key files |
|--------------|---------|-----------|
| `/` | Auth redirect | `src/app/page.tsx` |
| `/login` | Magic link sign-in | `src/app/login/page.tsx` |
| `/onboarding` | First-run profile setup | `src/app/onboarding/page.tsx` |
| `/dashboard` | Home hub (role-aware) | `src/app/(protected)/dashboard/page.tsx` |
| `/checkins` | Monthly check-ins list/create/detail | `src/app/(protected)/checkins/**` |
| `/quarterly-checkins` | Quarterly employee reviews | `src/app/(protected)/quarterly-checkins/**` |
| `/okrs` | Goals (OKRs) CRUD | `src/app/(protected)/okrs/**` |
| `/team` | Manager report list + member hub | `src/app/(protected)/team/**` |
| `/scoring` | Manager quarterly 1–5 scoring | `src/app/(protected)/scoring/[employeeId]/[periodId]/page.tsx` |
| `/annual-scores` | Annual roll-up / finalize | `src/app/(protected)/annual-scores/[employeeId]/page.tsx` |
| `/my-performance` | Employee performance summary | `src/app/(protected)/my-performance/page.tsx` |
| `/inbox` | Manager pending OKR approvals | `src/app/(protected)/inbox/page.tsx` |
| `/org` | Org chart (read) | `src/app/(protected)/org/page.tsx` |
| `/analytics` | HR/manager charts | `src/app/(protected)/analytics/page.tsx` |
| `/guide` | Framework guide content | `src/app/(protected)/guide/page.tsx` |
| `/settings` | Profile, notifications, appearance | `src/app/(protected)/settings/page.tsx` |
| `/admin` | HR admin (users, org, values, scores, calibration) | `src/app/(protected)/admin/**` |

**Route groups:**
- `(protected)/` — does not affect URL; shares `src/app/(protected)/layout.tsx` and requires onboarding.

## Component Organization (`src/components/`)

| Folder | Responsibility | Example files |
|--------|----------------|---------------|
| `admin/` | HR admin tables, org tree, values, pulse options | `UsersTable.tsx`, `OrgTree.tsx` |
| `analytics/` | Recharts visualizations | `ScoreDistributionChart.tsx` |
| `auth/` | Login, sign-out, magic link | `MagicLinkForm.tsx` |
| `checkins/` | Monthly/quarterly forms, MIT lists, mood | `EmployeeCheckinForm.tsx`, `MitPlanList.tsx` |
| `dashboard/` | Dashboard widgets | `PulseCard.tsx`, `PendingApprovals.tsx` |
| `guide/` | Editable guide sections | `GuideSectionEditor.tsx` |
| `kudos/` | Peer recognition | `SendKudosSheet.tsx` |
| `layout/` | App chrome | `Header.tsx`, `Sidebar.tsx`, `StandardLayout.tsx` |
| `okrs/` | Goal forms and status | `OkrForm.tsx`, `OkrProgressControls.tsx` |
| `onboarding/` | Onboarding wizards | `OnboardingForm.tsx` |
| `org/` | Org chart visualization | `OrgChart.tsx` |
| `performance/` | Scoring forms | `QuarterlyScoringForm.tsx` |
| `profile/` | Profile settings UI | `ProfileSettingsForm.tsx` |
| `settings/` | Settings page sections | `NotificationsSection.tsx` |
| `team/` | Manager team tools | `InviteTeamMember.tsx` |
| `theme/` | Dark/light provider | `ThemeProvider.tsx` |
| `ui/` | Shadcn/Radix primitives | `button.tsx`, `select.tsx`, `form.tsx` |

## Server Actions (`src/lib/actions/`)

| File | Domain |
|------|--------|
| `checkin-actions.ts` | Monthly check-in employee/manager upsert, reopen |
| `quarterly-checkin-actions.ts` | Quarterly check-in upsert/delete |
| `okr-actions.ts` | Goal CRUD and status transitions |
| `okr-progress-actions.ts` | Key result / initiative progress |
| `performance-actions.ts` | Quarterly scores, visibility, annual finalize |
| `period-actions.ts` | Auto-create/advance `performance_periods` |
| `onboarding-actions.ts` | Onboarding submit, team request approve/decline |
| `user-actions.ts` | Profile, role, manager assignment, notification prefs |
| `team-actions.ts` | Invite team member |
| `admin-actions.ts` | Deactivate user, company values, pulse options |
| `guide-actions.ts` | Guide section updates |
| `kudos-actions.ts` | Send/delete kudos |
| `historical-review-actions.ts` | LLM extract + save past reviews |

## Naming Conventions

**Files:**
- **Pages:** `page.tsx` in kebab-case route folders (`[checkinId]`, `[employeeId]`).
- **Layouts:** `layout.tsx` per segment; `loading.tsx`, `error.tsx` where needed.
- **Components:** PascalCase `.tsx` (`EmployeeCheckinForm.tsx`); one default export component per file.
- **Server Actions:** kebab-case `*-actions.ts` in `src/lib/actions/`.
- **Migrations:** `000NN_snake_case_description.sql`.
- **Netlify functions:** kebab-case `.mts` matching deployed name in `netlify.toml`.

**Directories:**
- **Routes:** kebab-case (`quarterly-checkins`, `annual-scores`).
- **Components:** lowercase domain folders (`checkins`, `okrs`).
- **Route groups:** parentheses, e.g. `(protected)` — not in URL.

**Symbols:**
- **React components:** PascalCase function components (`export default function DashboardPage`).
- **Server Actions:** camelCase verbs (`upsertCheckinEmployee`, `ensureCurrentPeriod`).
- **Types/interfaces:** PascalCase in `src/lib/types/database.ts` (`Profile`, `ReviewMit`).
- **DB-aligned fields:** snake_case in types and FormData (`review_mits`, `okr_id`); user-facing copy says "Goal".

**Imports:**
- Use `@/` alias for all app imports (`@/components/...`, `@/lib/...`).
- Order observed: external packages → `@/` absolute → relative (rare).

## Where to Add New Code

**New authenticated page:**
- Primary code: `src/app/(protected)/<feature>/page.tsx`
- Shared shell: automatic via `src/app/(protected)/layout.tsx`
- HR-only: nest under `src/app/(protected)/admin/` and rely on `src/app/(protected)/admin/layout.tsx`

**New mutation (create/update/delete):**
- Implementation: new or existing file in `src/lib/actions/<domain>-actions.ts` with `'use server'`
- Validation: Zod schemas colocated in the action file
- Do not add `src/app/api/` routes for domain writes

**New read-heavy view without mutation:**
- Prefer async RSC `page.tsx` with `createClient()` queries
- If queries grow beyond ~50 lines, extract to `src/lib/queries/<name>.ts` (convention to adopt — directory does not exist yet)

**New interactive UI:**
- Feature component: `src/components/<domain>/<ComponentName>.tsx`
- Add `'use client'` only when using hooks, browser APIs, or event handlers
- Reuse primitives from `src/components/ui/`; style with `lr-*` tokens from `src/app/globals.css`

**New Shadcn primitive:**
- Run Shadcn CLI per `components.json` → lands in `src/components/ui/`
- Override popover/select with project dropdown conventions (`side="bottom"`, `bg-lr-bg`)

**New database table / RPC / policy:**
- SQL: next sequential file in `supabase/migrations/000NN_<name>.sql`
- Types: extend `src/lib/types/database.ts` (`Database` and exported interfaces)
- Apply: `npm run supabase:push` (uses pooler URL from `.env.local`)

**New scheduled / background job:**
- Handler: `netlify/functions/<name>.mts`
- Schedule: add `[functions."<name>"]` block in `netlify.toml`
- Shared logic: pure functions in `src/lib/` (importable from both Next and Netlify)

**New unit tests:**
- Colocate under `src/lib/__tests__/` or next to module as `*.test.ts`
- Run via `npm test` (Vitest)

**New static asset:**
- `public/<file>` — reference as `/file` from pages

## Special Directories

**`.planning/`:**
- Purpose: GSD roadmap, codebase maps, phase plans.
- Generated: Partially agent-written.
- Committed: Yes — planning context for humans/agents; not imported by app.

**`.netlify/`:**
- Purpose: Local Netlify dev/build cache.
- Generated: Yes.
- Committed: No (typically gitignored).

**`node_modules/`, `.next/`:**
- Purpose: Dependencies and Next build output.
- Generated: Yes.
- Committed: No.

**`docs/superpowers/`:**
- Purpose: Feature design archives (check-in v2, manager improvements).
- Generated: No.
- Committed: Yes — reference only when implementing related features.

**`src/components/ui/`:**
- Purpose: Owned Shadcn component copies (not npm package).
- Generated: Via Shadcn CLI init/add.
- Committed: Yes — customize with LR tokens.

**`supabase/.temp/`:**
- Purpose: Supabase CLI local state.
- Generated: Yes.
- Committed: No.

## Path Alias Reference

From `tsconfig.json` / `components.json`:

| Alias | Resolves to |
|-------|-------------|
| `@/*` | `src/*` |
| `@/components` | `src/components` |
| `@/components/ui` | `src/components/ui` |
| `@/lib` | `src/lib` |
| `@/lib/utils` | `src/lib/utils.ts` (`cn()` helper) |
| `@/hooks` | `src/hooks` (alias configured; directory not present — create if adding hooks) |

## Related Non-Source Areas

- **`scripts/netlify-build.sh`:** Production build wrapper invoked by Netlify (`npm run build:deploy`).
- **`deno.lock`:** Lockfile for Deno-used Netlify function tooling (if applicable).
- **`AGENTS.md` / `CLAUDE.md`:** Agent-oriented project rules (stack, conventions, GSD workflow).

---

*Structure analysis: 2026-06-04*
