# Technology Stack

LunarTrack (internal package name: `ciaobob`) — Next.js 16 App Router performance management tool.

**Analysis Date:** 2026-05-23

---

## Languages

**Primary:**
- TypeScript 5.x — all application code (`tsconfig.json` strict mode enabled)

**Secondary:**
- None — no Python, Go, or other server-side languages

**TypeScript Config highlights (`tsconfig.json`):**
- `strict: true`
- `target: "ES2017"`
- `moduleResolution: "bundler"` (Next.js bundler mode)
- Path alias: `@/*` → `./src/*`
- `isolatedModules: true`

---

## Runtime

**Environment:**
- Node.js 20 (pinned in `netlify.toml` `[build.environment] NODE_VERSION = "20"`)

**Package Manager:**
- npm (lockfile: `package-lock.json` present)

---

## Frameworks

**Core:**
- Next.js `16.2.4` — App Router, Server Components, Server Actions (no API routes for app logic)
- React `19.2.4` — UI runtime; ships with Next.js 16
- React DOM `19.2.4`

**Build/Dev:**
- Turbopack — default bundler in Next.js 16 (`next dev` uses Turbopack automatically)
- PostCSS via `@tailwindcss/postcss ^4` (`postcss.config.mjs`)
- ESLint `^9` with `eslint-config-next 16.2.4` (core-web-vitals + TypeScript rules; `eslint.config.mjs`)

**Testing:**
- Vitest `^4.1.7` — test runner
  - Run: `npm test` (single run) / `npm run test:watch` (watch mode)
  - No vitest config file found; runs with defaults
  - One test file: `src/lib/__tests__/reminder-logic.test.ts`

---

## Styling

**Framework:** Tailwind CSS `^4` (CSS-first config, no `tailwind.config.ts`)
- Config lives in `src/app/globals.css` via `@theme` directives
- `@tailwindcss/postcss ^4` for PostCSS integration
- `@tailwindcss/typography ^0.5.19` — used in rich-text/guide content

**Component Library:** Shadcn/ui (new-york style, `components.json`)
- Components owned in `src/components/ui/`
- Icon library: `lucide-react ^1.8.0`
- Base color: neutral; CSS variables enabled
- Installed components: `alert`, `avatar`, `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `select`, `separator`, `sheet`, `table`, `tabs`, `textarea`

**Design System:** LR Design System tokens
- `lr-*` CSS custom properties (e.g. `bg-lr-bg`, `text-lr-text`)
- Fonts loaded via `next/font/google`: Space Grotesk (display/headings, `--font-display`) + Inter (body, `--font-sans`)
- Applied in `src/app/layout.tsx`

**Utilities:**
- `clsx ^2.1.1` — conditional class names
- `tailwind-merge ^3.5.0` — merge Tailwind classes without conflicts
- `class-variance-authority ^0.7.1` — variant-based component styling

---

## State Management

**Client State:** Zustand `^5.0.12`
- Used in `src/app/layout.tsx` (NuqsAdapter wraps all children)
- No dedicated store files found in `src/lib/` — state likely co-located in feature components

**URL State:** nuqs `^2.8.9`
- `NuqsAdapter` wraps root layout at `src/app/layout.tsx`
- Provides `useQueryState` for type-safe search params

---

## Form Handling

- React Hook Form `^7.73.1` — uncontrolled input model, integrates with Server Actions
- `@hookform/resolvers ^5.2.2` — Zod → RHF bridge
- Zod `^4.3.6` — schema validation (import from `"zod"`, v4 is package root)

---

## Data Access

**Pattern:** Server Components + Server Actions (no API routes for app logic)
- Server action files in `src/lib/actions/`: `admin-actions.ts`, `checkin-actions.ts`, `guide-actions.ts`, `okr-actions.ts`, `okr-progress-actions.ts`, `onboarding-actions.ts`, `performance-actions.ts`, `period-actions.ts`, `quarterly-checkin-actions.ts`, `user-actions.ts`
- 11 files with `'use server'` directive
- 48 files with `'use client'` directive

**Database client:** `@supabase/supabase-js ^2.104.0`
- Browser client: `src/lib/supabase/client.ts` — `createBrowserClient` from `@supabase/ssr`
- Server client: `src/lib/supabase/server.ts` — `createServerClient` from `@supabase/ssr`

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | `16.2.4` | Core framework |
| `react` / `react-dom` | `19.2.4` | UI runtime |
| `@supabase/ssr` | `^0.10.2` | SSR-safe Supabase client (replaces deprecated auth-helpers) |
| `@supabase/supabase-js` | `^2.104.0` | Supabase database + auth client |
| `zod` | `^4.3.6` | Schema validation |
| `react-hook-form` | `^7.73.1` | Form state management |
| `zustand` | `^5.0.12` | Client-side global state |
| `nuqs` | `^2.8.9` | Type-safe URL state (`useQueryState`) |
| `tailwindcss` | `^4` | Utility-first CSS |
| `radix-ui` | `^1.4.3` | Headless primitives (consumed via Shadcn) |
| `date-fns` | `^4.1.0` | Date/quarter calculations |
| `recharts` | `^3.8.1` | Charts (analytics, org performance curves) |
| `resend` | `^6.12.3` | Email notifications (via Resend API) |
| `marked` | `^18.0.2` | Markdown → HTML rendering (guide content) |
| `sanitize-html` | `^2.17.3` | Sanitize rendered HTML (XSS protection) |
| `@tanstack/react-table` | `^8.21.3` | Data tables (dep declared; not actively used in source as of analysis) |

---

## Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | `^4.1.7` | Test runner |
| `typescript` | `^5` | Type checking |
| `eslint` | `^9` | Linting |
| `eslint-config-next` | `16.2.4` | Next.js ESLint rules |
| `tailwindcss` | `^4` | CSS build |
| `@tailwindcss/postcss` | `^4` | PostCSS integration |
| `@netlify/functions` | `^5.2.2` | Netlify scheduled function types |
| `@netlify/plugin-nextjs` | `^5.15.11` | Next.js on Netlify adapter |
| `pg` | `^8.21.0` | PostgreSQL client (likely for migrations/scripts) |

---

## Platform Requirements

**Development:**
- Node.js 20+
- npm

**Production:**
- Deployed on **Netlify** (`netlify.toml`, `@netlify/plugin-nextjs`)
- Build: `npm run build` → `.next/`
- Scheduled functions: Netlify Functions with esbuild bundler, `netlify/functions/` directory

---

*Stack analysis: 2026-05-23*
