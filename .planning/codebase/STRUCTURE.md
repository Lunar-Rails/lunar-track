# Codebase Structure

**Analysis Date:** 2026-05-23

## Directory Layout

```
lunar-track-org/
├── src/
│   ├── app/                         # Next.js App Router — routes, layouts, pages
│   │   ├── layout.tsx               # Root layout: fonts, ThemeProvider, NuqsAdapter
│   │   ├── page.tsx                 # Root redirect (→ /dashboard or /login)
│   │   ├── globals.css              # Global CSS, LR design tokens
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts         # OAuth code exchange + domain check
│   │   ├── login/
│   │   │   └── page.tsx             # Google sign-in page
│   │   ├── onboarding/
│   │   │   ├── page.tsx             # New-employee onboarding (manager select)
│   │   │   └── reset/
│   │   │       └── route.ts         # Clears pending_manager_id (re-select)
│   │   └── (protected)/             # Route group — auth-gated; no URL segment
│   │       ├── layout.tsx           # Auth gate, profile provision, period init
│   │       ├── dashboard/
│   │       │   └── page.tsx         # Home dashboard — check-ins, OKRs, scores, mood
│   │       ├── checkins/
│   │       │   ├── page.tsx         # Monthly check-in list
│   │       │   ├── new/
│   │       │   │   └── page.tsx     # New monthly check-in form
│   │       │   └── [checkinId]/
│   │       │       └── page.tsx     # View/edit a single check-in
│   │       ├── quarterly-checkins/
│   │       │   ├── page.tsx         # Quarterly check-in list
│   │       │   ├── new/
│   │       │   │   └── page.tsx     # New quarterly check-in form
│   │       │   └── [checkinId]/
│   │       │       └── page.tsx     # View/edit a quarterly check-in
│   │       ├── okrs/
│   │       │   ├── page.tsx         # OKR list for current period
│   │       │   ├── new/
│   │       │   │   └── page.tsx     # Create new OKR
│   │       │   └── [okrId]/
│   │       │       └── page.tsx     # View/edit OKR + key results + initiatives
│   │       ├── scoring/
│   │       │   └── [employeeId]/
│   │       │       └── [periodId]/
│   │       │           └── page.tsx # Manager quarterly scoring form
│   │       ├── team/
│   │       │   ├── page.tsx         # Manager's direct reports list
│   │       │   └── [employeeId]/
│   │       │       └── page.tsx     # Individual employee 360 view
│   │       ├── annual-scores/
│   │       │   └── [employeeId]/
│   │       │       └── page.tsx     # Annual score finalization
│   │       ├── my-performance/
│   │       │   └── page.tsx         # Employee's own performance history
│   │       ├── inbox/
│   │       │   └── page.tsx         # Manager/HR pending actions (check-ins + OKR approvals)
│   │       ├── org/
│   │       │   └── page.tsx         # Org chart tree view
│   │       ├── analytics/
│   │       │   └── page.tsx         # HR_ADMIN analytics dashboard
│   │       ├── guide/
│   │       │   └── page.tsx         # Framework guide (editable by HR_ADMIN)
│   │       └── admin/
│   │           ├── layout.tsx       # HR_ADMIN role gate
│   │           ├── page.tsx         # Admin home
│   │           ├── settings/
│   │           │   └── page.tsx     # Org settings
│   │           ├── users/
│   │           │   └── page.tsx     # User management table
│   │           ├── org/
│   │           │   └── page.tsx     # Org structure editor
│   │           ├── scores/
│   │           │   ├── page.tsx     # Score overview / visibility toggles
│   │           │   └── calibration/
│   │           │       └── page.tsx # Score calibration view
│   │           └── values/
│   │               └── page.tsx     # Company values admin
│   ├── components/
│   │   ├── admin/                   # HR_ADMIN-specific UI components
│   │   │   ├── CompanyValuesAdmin.tsx
│   │   │   ├── ManagerSelect.tsx
│   │   │   ├── OrgTree.tsx
│   │   │   ├── PeriodFilter.tsx
│   │   │   ├── PulseOptionsAdmin.tsx
│   │   │   ├── RoleSelect.tsx
│   │   │   ├── StickyAdminHeader.tsx
│   │   │   └── UsersTable.tsx
│   │   ├── analytics/               # Chart components (HR_ADMIN analytics page)
│   │   │   ├── MoodTrendOrgChart.tsx
│   │   │   ├── PerformerCurveChart.tsx
│   │   │   ├── ScoreDistributionChart.tsx
│   │   │   └── ValueUsageChart.tsx
│   │   ├── auth/                    # Login UI components
│   │   │   ├── MagicLinkForm.tsx
│   │   │   ├── SignInButton.tsx
│   │   │   └── SignOutButton.tsx
│   │   ├── checkins/                # Monthly + quarterly check-in form components
│   │   │   ├── DeleteQuarterlyCheckinButton.tsx
│   │   │   ├── EmployeeCheckinForm.tsx     # Employee pre-meeting section
│   │   │   ├── GoalAchievementList.tsx
│   │   │   ├── MitPlanList.tsx
│   │   │   ├── MitReviewList.tsx
│   │   │   ├── MonthSelector.tsx
│   │   │   ├── MonthlyDoneWellSummary.tsx
│   │   │   ├── MoodSelector.tsx
│   │   │   ├── MoodTrendSummary.tsx
│   │   │   ├── QuarterlyCheckinEmployeeForm.tsx
│   │   │   ├── ScheduleCallButton.tsx
│   │   │   └── ValueChipSelector.tsx
│   │   ├── dashboard/               # Dashboard-specific widgets
│   │   │   ├── PendingApprovals.tsx # Manager join request approvals card
│   │   │   └── PulseCard.tsx        # Mood/energy pulse widget
│   │   ├── guide/
│   │   │   └── GuideSectionEditor.tsx  # Rich-text guide section editor
│   │   ├── layout/                  # Shell components
│   │   │   ├── Header.tsx           # Top bar with user avatar + sign out
│   │   │   ├── Sidebar.tsx          # Role-aware nav sidebar
│   │   │   └── StandardLayout.tsx   # Wrapper: Header + Sidebar + main content
│   │   ├── okrs/                    # OKR management components
│   │   │   ├── AddEntryButton.tsx
│   │   │   ├── DeleteGoalButton.tsx
│   │   │   ├── OkrForm.tsx
│   │   │   ├── OkrProgressControls.tsx
│   │   │   └── OkrStatusActions.tsx
│   │   ├── onboarding/
│   │   │   └── OnboardingForm.tsx   # Manager-select + name form for new users
│   │   ├── performance/             # Scoring forms
│   │   │   ├── AnnualScoreForm.tsx  # HR_ADMIN annual score override form
│   │   │   └── QuarterlyScoringForm.tsx  # Manager quarterly 1-5 score form
│   │   ├── theme/
│   │   │   ├── ThemeProvider.tsx    # next-themes wrapper
│   │   │   └── ThemeToggle.tsx      # Light/dark toggle button
│   │   └── ui/                      # Shadcn/ui components (owned copies)
│   │       ├── alert.tsx
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── form.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       └── textarea.tsx
│   └── lib/
│       ├── actions/                 # Server Actions ('use server')
│       │   ├── admin-actions.ts     # User management, role/manager assignment, score visibility
│       │   ├── checkin-actions.ts   # Monthly check-in upsert (employee + manager sections)
│       │   ├── guide-actions.ts     # Guide section CRUD
│       │   ├── okr-actions.ts       # OKR + key result CRUD, status transitions
│       │   ├── okr-progress-actions.ts  # Key result progress status + initiative completion
│       │   ├── onboarding-actions.ts    # Profile setup, manager request, approve/decline
│       │   ├── performance-actions.ts   # Quarterly scores + annual score upserts
│       │   ├── period-actions.ts    # Auto-advance performance periods (ensureCurrentPeriod)
│       │   ├── quarterly-checkin-actions.ts  # Quarterly check-in upsert
│       │   └── user-actions.ts      # Profile self-update
│       ├── auth/
│       │   └── allowed-domains.ts   # Email domain whitelist (lunarrails.io, 40acres.pro, etc.)
│       ├── constants/
│       │   └── mood.ts              # Mood/energy label constants
│       ├── supabase/
│       │   ├── client.ts            # Browser Supabase client (createBrowserClient)
│       │   └── server.ts            # Server Supabase client (createServerClient) + getOrProvisionProfile
│       ├── types/
│       │   └── database.ts          # All TypeScript interfaces + Database type map
│       ├── __tests__/
│       │   └── reminder-logic.test.ts  # Unit test for reminder scheduling logic
│       ├── notifications.ts         # Resend email helpers (check-in submitted/reviewed, OKR approved)
│       ├── reminder-logic.ts        # Logic for scheduling reminder emails
│       ├── slack.ts                 # Slack notification helpers
│       └── utils.ts                 # cn() class merger utility
├── supabase/
│   └── migrations/                  # Sequential SQL migrations (run order matters)
│       ├── 00001_foundation.sql     # profiles, org_closure, performance_periods, RLS, SECURITY DEFINER fns
│       ├── 00002_core_features.sql  # okrs, okr_initiatives, checkins, RLS
│       ├── 00003_performance_cycle.sql  # quarterly_okr_reviews, quarterly_scores, annual_scores, RLS
│       ├── 00004_framework_guide.sql    # guide_sections table
│       ├── 00005_quarterly_checkins.sql # quarterly_checkins table, RLS
│       ├── 00006_company_values.sql     # company_values table + value_ratings JSONB on quarterly_scores
│       ├── 00007_drop_quarterly_okr_reviews.sql  # Removes unused table
│       ├── 00008_okr_progress.sql       # progress_status on key_results, completed on initiatives
│       ├── 00009_mits_jsonb.sql         # Migrates MITs from fixed columns to JSONB arrays
│       ├── 00010_org_structure.sql      # Seeds full Lunar Rails org roster + hierarchy
│       ├── 00011_checkin_v2.sql         # Checkin v2 schema updates
│       ├── 00012_live_reconciliation.sql  # Profile live-reconciliation RPC
│       ├── 00013_auth_onboarding_hardening.sql  # is_onboarded, pending_manager_id on profiles
│       ├── 00014_fix_postgrest_authenticator_grants.sql
│       ├── 00015_fix_auth_identities.sql
│       ├── 00016_mgr_private_note.sql   # mgr_private_note column on checkins + quarterly_checkins
│       ├── 00017_ai_builder_and_values.sql  # AI builder fields, value_self_assessments on quarterly_checkins
│       ├── 00018_domain_whitelist.sql   # DB-layer email domain restriction trigger
│       ├── 00019_ai_builder_and_values.sql  # (duplicate slug — additive AI builder fields)
│       ├── 00019_mood_tracking.sql      # mood_energy, mood_productivity on checkins
│       ├── 00020_hr_admins_max_francesco.sql  # Seeds specific HR_ADMIN users
│       ├── 00021_goals_soft_delete.sql  # deleted_at on okrs (soft delete)
│       ├── 00022_cleanup_demo_data.sql  # Removes demo rows
│       ├── 00023_pulse_options.sql      # pulse_options table for configurable mood labels
│       └── 00024_pulse_options_ensure.sql  # Ensures pulse_options rows exist
├── netlify/
│   └── functions/                   # Netlify serverless functions (non-Next.js)
├── docs/
│   └── superpowers/                 # Planning documents (specs, plans)
├── public/                          # Static assets (favicons, OG image)
├── CLAUDE.md                        # Project-level AI assistant instructions
├── AGENTS.md                        # Agent configuration
├── components.json                  # Shadcn/ui configuration
├── eslint.config.mjs
├── netlify.toml                     # Netlify build + function config
├── next.config.ts                   # Next.js config (minimal — no custom config)
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

## Directory Purposes

**`src/app/(protected)/`:**
- Purpose: All authenticated application pages
- Contains: Server Component pages that fetch data directly from Supabase, role-specific layouts
- Key files: `layout.tsx` (auth gate), `dashboard/page.tsx` (primary landing)

**`src/components/ui/`:**
- Purpose: Shadcn/ui base components — owned copies, not imported from npm
- Contains: Radix-based primitives styled with LR design tokens
- Note: Customize here directly; do not install new Shadcn components without copying them in

**`src/lib/actions/`:**
- Purpose: All write operations for the application
- Contains: `'use server'` files grouped by domain
- Pattern: Every action validates auth via `getCallerProfile()` before any DB write

**`src/lib/types/database.ts`:**
- Purpose: Single source of truth for all TypeScript types
- Contains: All entity interfaces, the `Database` mapped type for Supabase client generics, enum types
- Note: Manually maintained — must be kept in sync with migrations

**`supabase/migrations/`:**
- Purpose: Ordered SQL migration history
- Contains: DDL, RLS policies, SECURITY DEFINER functions, seed data
- Note: Two files share the `00019_` prefix — this is a naming collision in the migration history

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Root redirect
- `src/app/(protected)/layout.tsx`: Auth + session bootstrap on every protected request
- `src/app/auth/callback/route.ts`: OAuth callback handler

**Configuration:**
- `src/lib/auth/allowed-domains.ts`: Email domain whitelist
- `components.json`: Shadcn/ui config (component paths, Tailwind config)
- `netlify.toml`: Deployment config

**Core Logic:**
- `src/lib/supabase/server.ts`: Server-side Supabase client + `getOrProvisionProfile()`
- `src/lib/actions/period-actions.ts`: `ensureCurrentPeriod()` — period auto-management
- `src/lib/types/database.ts`: All types
- `src/lib/notifications.ts`: Email notification helpers

**Testing:**
- `src/lib/__tests__/reminder-logic.test.ts`: Only test file in the codebase

## Naming Conventions

**Files:**
- Pages and layouts: `page.tsx`, `layout.tsx` (Next.js convention)
- Components: PascalCase, descriptive noun phrases — `QuarterlyScoringForm.tsx`, `PendingApprovals.tsx`
- Server Actions files: kebab-case, domain-grouped — `checkin-actions.ts`, `performance-actions.ts`
- Utility files: camelCase — `utils.ts`, `notifications.ts`

**Directories:**
- Feature directories match route segment names: `checkins/`, `okrs/`, `quarterly-checkins/`
- Component directories match feature: `src/components/checkins/`, `src/components/okrs/`

**Exports:**
- Pages: default export only (Next.js requirement)
- Components: default export
- Actions: named exports (each action is a named `async function`)
- Types: named exports from `src/lib/types/database.ts`

## Where to Add New Code

**New page (authenticated):**
- Add `src/app/(protected)/[feature]/page.tsx` as an async Server Component
- Add `export const dynamic = 'force-dynamic'` at the top
- Fetch data directly using `await createClient()` from `src/lib/supabase/server.ts`
- Add nav link in `src/components/layout/Sidebar.tsx` if needed

**New mutation (Server Action):**
- Add to the appropriate `src/lib/actions/[domain]-actions.ts` file
- Start with `'use server'` directive
- Call `getCallerProfile()` first, check `caller.role`
- Use Zod schema for input validation
- End with `revalidatePath('/relevant-path')`
- Return `{ success: true }` or `{ error: string }`

**New interactive component:**
- Add `'use client'` at top
- Place in `src/components/[feature]/ComponentName.tsx`
- Import Server Actions directly (Next.js handles the boundary)
- Use Shadcn/ui components from `src/components/ui/`

**New DB table:**
- Create `supabase/migrations/000XX_description.sql`
- Define table, indexes, `ENABLE ROW LEVEL SECURITY`, and all RLS policies
- Add TypeScript interface to `src/lib/types/database.ts`
- Add to the `Database['public']['Tables']` map in the same file

**New Shadcn component:**
- Run `npx shadcn@latest add [component]` (copies into `src/components/ui/`)
- Apply LR design tokens in the copied file as needed

## Special Directories

**`supabase/migrations/`:**
- Purpose: Sequential DB migration history
- Generated: No — hand-authored
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning artifacts (codebase maps, phase plans)
- Generated: Yes (by GSD workflow commands)
- Committed: Yes

**`netlify/functions/`:**
- Purpose: Netlify serverless functions outside Next.js
- Generated: No
- Committed: Yes

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-05-23*
