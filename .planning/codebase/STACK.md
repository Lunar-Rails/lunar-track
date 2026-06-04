---
last_mapped_commit: 804cf743d1651aa9bd1d761c60c4d1478e38a540
---

# Technology Stack

**Analysis Date:** 2026-06-04

## Languages

**Primary:**
- **TypeScript** (^5, strict) — entire application under `src/`, Netlify functions under `netlify/functions/`, shared logic in `src/lib/`
- **SQL** — schema and RLS in `supabase/migrations/*.sql` (32 migration files)

**Secondary:**
- **Bash** — deployment and migration scripts in `scripts/netlify-build.sh`, npm script wrappers in `package.json`
- **CSS** — Tailwind v4 + LR design tokens in `src/app/globals.css`

## Runtime

**Environment:**
- **Node.js 20** — pinned in `netlify.toml` `[build.environment] NODE_VERSION = "20"`
- **Next.js 16.2.4** App Router — single deployable app (no monorepo packages)

**Package Manager:**
- **npm** (primary) — `package-lock.json` present; install via `npm install`
- Lockfile: **present** (`package-lock.json`, lockfileVersion 3)
- Additional lockfiles exist (`bun.lock`, `deno.lock`) but `package.json` scripts and Netlify build use npm

## Frameworks

**Core:**
- **Next.js 16.2.4** — App Router, Server Components, Server Actions, Route Handlers (`src/app/**/route.ts`)
- **React 19.2.4** — UI runtime with React Server Components
- **React DOM 19.2.4**

**Testing:**
- **Vitest 4.1.7** — unit tests; run via `npm test` / `npm run test:watch`
- Config: **not detected** (no `vitest.config.*`; Vitest uses defaults)
- Tests: `src/lib/__tests__/reminder-logic.test.ts` only

**Build/Dev:**
- **Turbopack** — default for `npm run dev` (`next dev`)
- **ESLint 9** + `eslint-config-next` 16.2.4 — `eslint.config.mjs`
- **PostCSS** + `@tailwindcss/postcss` — `postcss.config.mjs`
- **Supabase CLI** (^2.20.12, devDependency) — `supabase db push` in build and `npm run supabase:push`

## Key Dependencies

**Critical (app cannot run without):**
- `next@16.2.4` — framework
- `react@19.2.4` / `react-dom@19.2.4` — UI
- `@supabase/supabase-js@^2.104.0` — database, auth, storage client
- `@supabase/ssr@^0.10.2` — cookie-based SSR auth (`src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/proxy.ts`)
- `zod@^4.3.6` — validation in Server Actions (`src/lib/actions/*.ts`)

**Data & auth:**
- `@supabase/ssr` + `@supabase/supabase-js` — all persistence and Google/magic-link auth flows
- `pg@^8.21.0` (dev) — used indirectly via Supabase CLI for remote migrations

**UI & styling:**
- `tailwindcss@^4` + `@tailwindcss/postcss` — utility CSS
- `@tailwindcss/typography` — prose styling for guide content
- `radix-ui@^1.4.3` — headless primitives (via Shadcn copies in `src/components/ui/`)
- `class-variance-authority`, `clsx`, `tailwind-merge` — component variants (`src/lib/utils.ts`)
- `lucide-react` — icons (Shadcn `iconLibrary` in `components.json`)
- LR Design System — **in-repo CSS variables**, not a separate npm package; tokens in `src/app/globals.css` (`--lr-*`, `.dark` theme)

**Forms & state:**
- `react-hook-form@^7.73.1` + `@hookform/resolvers@^5.2.2` — used in `src/components/performance/AnnualScoreForm.tsx` and Shadcn `src/components/ui/form.tsx`
- Monthly/quarterly check-in forms use **plain `useState`** per project conventions (not RHF)
- `nuqs@^2.8.9` — URL query state; `NuqsAdapter` in `src/app/layout.tsx`
- `zustand@^5.0.12` — **declared in `package.json` but not imported under `src/`** (no global client stores in use)

**Domain libraries:**
- `date-fns@^4.1.0` — period/quarter date logic
- `@tanstack/react-table@^8.21.3` — **declared but no imports under `src/`**
- `recharts@^3.8.1` — HR analytics charts (`src/components/analytics/*.tsx`)
- `marked@^18.0.2` + `sanitize-html@^2.17.3` — framework guide rendering (`src/app/(protected)/guide/page.tsx`)
- `openai@^6.39.0` — historical review LLM extraction (`src/lib/actions/historical-review-actions.ts`, model `gpt-4o-mini`)

**Notifications (see INTEGRATIONS.md):**
- Email runtime uses **Mailtrap HTTP API** in `src/lib/notifications.ts` (`MAILTRAP_API_TOKEN`)
- `resend@^6.12.3` — **dependency present, no application imports**; `.env.example` still documents Resend vars

**Netlify serverless:**
- `@netlify/functions@^5.2.2` — scheduled reminder handlers
- `@netlify/plugin-nextjs@^5.15.11` — Next.js on Netlify

## Configuration

**Environment:**
- Template: `.env.example` (committed; documents variable names only)
- Local/runtime: `.env.local` (gitignored; not read by mapper)
- Required for app: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`
- Build/deploy migrations: `SUPABASE_POOLER` (Postgres URI for `supabase db push`)
- Optional/feature: `SUPABASE_SERVICE_ROLE_KEY`, `MAILTRAP_API_TOKEN`, `MAILTRAP_FROM`, `SLACK_WORKSPACE_TOKENS`, `REMINDER_SECRET`, `REMINDER_DATE_OVERRIDE`, `OPENAI_API_KEY`, `NEXT_PUBLIC_SITE_URL`

**Build:**
- `next.config.ts` — minimal Next config (empty options object)
- `tsconfig.json` — strict TS, path alias `@/*` → `./src/*`, excludes `netlify` and `pmai`
- `components.json` — Shadcn CLI config (style `new-york`, RSC, CSS in `src/app/globals.css`)
- `netlify.toml` — build command, Node version, function schedules, Next plugin
- `supabase/config.toml` — local Supabase project (`project_id = "lunar-track"`, Postgres major version 17)

**Scripts (`package.json`):**
| Script | Purpose |
|--------|---------|
| `dev` | `next dev` (port 3000) |
| `build` | `next build` |
| `build:deploy` | `scripts/netlify-build.sh` (migrations + build) |
| `start` | `next start` |
| `lint` | `eslint` |
| `test` / `test:watch` | Vitest |
| `supabase:push` | Remote migration via `SUPABASE_POOLER` |

## Platform Requirements

**Development:**
- Node.js 20+
- npm
- Supabase project credentials in `.env.local`
- Optional: Supabase CLI for local stack (`supabase/config.toml` ports 54321–54329)

**Production:**
- **Netlify** — publish `.next`, build via `npm run build:deploy`
- **Supabase hosted** — PostgreSQL 17, Auth, Storage (`avatars` bucket per `supabase/migrations/00026_avatar_storage_and_notification_prefs.sql`)
- Scheduled **Netlify Functions** at 09:00 UTC daily (`netlify.toml`)

## Application Architecture (stack-level)

**Pattern:** Next.js App Router monolith — Server Components fetch via Supabase; mutations via Server Actions in `src/lib/actions/`; no REST API routes for core domain logic.

**Auth guard:** `src/app/(protected)/layout.tsx` calls `supabase.auth.getUser()` and redirects to `/login`. Note: `src/proxy.ts` exports `proxy` (not `middleware`) and is **not wired** as Next.js middleware — global edge auth from that file does not run.

**Entry layout:** `src/app/layout.tsx` — fonts (Google: Space Grotesk, Inter), `ThemeProvider`, `NuqsAdapter`.

**Route handlers:** `src/app/auth/callback/route.ts`, `src/app/onboarding/reset/route.ts`.

---

*Stack analysis: 2026-06-04*
