# Coding Conventions

**Analysis Date:** 2026-05-23

## Naming Patterns

**Files:**
- React components: PascalCase matching the exported component name — `EmployeeCheckinForm.tsx`, `QuarterlyScoringForm.tsx`, `Sidebar.tsx`
- Server actions: kebab-case module name with `-actions` suffix — `checkin-actions.ts`, `okr-actions.ts`, `performance-actions.ts`
- Utility/lib files: kebab-case — `reminder-logic.ts`, `allowed-domains.ts`
- Type files: `database.ts` under `src/lib/types/`

**Components:**
- PascalCase exports only — `export default function EmployeeCheckinForm(...)`, `export default function QuarterlyScoringForm(...)`
- Sub-components defined in the same file as private functions when tightly coupled — `ScoreColumn` in `QuarterlyScoringForm.tsx`, `NavLink` in `Sidebar.tsx`

**Functions:**
- Server actions: camelCase verb-noun — `upsertCheckinEmployee`, `createOkr`, `transitionOkrStatus`, `finalizeAnnualScore`
- Internal helpers in action files: camelCase — `getCallerProfile`, `carryMitsToNextMonth`
- React event handlers: camelCase `on`-prefix or descriptive verb — `onSave`, `onSubmit`, `handleAiBuilderChange`, `handleBvScoreChange`
- State initializers: camelCase `init`-prefix — `initReviewMits`, `initPlanMits`

**Variables / Props:**
- camelCase throughout
- Boolean props: no `is`/`has` prefix enforced — `readOnly`, `disabled`, `aiBuilderLocked` are the observed patterns
- Prop interfaces: component name + `Props` suffix — `EmployeeCheckinFormProps`, `OkrFormProps`, `SidebarProps`

**Types / Interfaces:**
- Interfaces for domain models: `Profile`, `Checkin`, `Okr`, `QuarterlyScore`
- `type` aliases for unions and mapped types: `UserRole`, `OkrStatus`, `ActionResult`, `Step`
- SCREAMING_SNAKE_CASE for enum-like string union members that map to DB enum values — `'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN'`, `'DRAFT' | 'PENDING_REVIEW' | 'APPROVED'`
- Database shape exported as `Database` type in `src/lib/types/database.ts` following Supabase gen conventions

## Import Organization

**Order (no enforced sorter, observed pattern):**
1. React and Next.js framework imports — `import { useTransition } from 'react'`, `import { redirect } from 'next/navigation'`
2. Third-party packages — `import { z } from 'zod'`, `import { revalidatePath } from 'next/cache'`
3. Internal `@/components/ui/*` (Shadcn primitives)
4. Internal `@/components/<domain>/*`
5. Internal `@/lib/actions/*`
6. Internal `@/lib/types/database`

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- All internal imports use `@/` — never relative `../` or `./` across directories

## TypeScript Patterns

**Strict mode:** Enabled (`"strict": true` in `tsconfig.json`).

**Type assertions:**
- `as SomeType` used after Supabase queries everywhere due to untyped client — suppressed with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` before every `(supabase as any)` cast. This is a pervasive workaround; see CONCERNS.md.
- `as const` used where discriminated unions need narrowing — `status: 'not_achieved' as const`

**Return type pattern for Server Actions:**
```typescript
type ActionResult = { success: true; id?: string } | { error: string }
```
This discriminated union is the universal Server Action return type — used in every action file. Callers check with `'error' in result`.

**Generics:**
- Supabase client typed with `createServerClient<Database>(...)` in `src/lib/supabase/server.ts`
- `Awaited<ReturnType<typeof createClient>>` used as the parameter type for the shared `getCallerProfile` helper

**Intersection / utility types:**
- `Pick<Okr, 'id' | 'period_id' | 'title' | 'description'>` used for partial props
- `Omit<Profile, 'created_at' | 'updated_at'> & { ... }` for Insert types in the `Database` type map

**`@deprecated` JSDoc:** Used on `QuarterlyCheckinOkrStatus` and the `status` field on `QuarterlyCheckinOkrProgress` to mark legacy schema fields.

## Component Patterns

**Server vs Client boundary:**
- All `app/(protected)/**/page.tsx` files are async Server Components — no `'use client'` directive
- All interactive forms carry `'use client'` at the top of the file
- `'use server'` is at the top of every file in `src/lib/actions/`
- `export const dynamic = 'force-dynamic'` is set on the protected layout (`src/app/(protected)/layout.tsx`) to prevent any route segment caching under auth

**Client component state pattern:**
- `useTransition` + local `isPending` state for all Server Action calls — never `useState(loading)`
- Error stored as `useState<string | null>(null)`, displayed inline as a styled `<div>` below the form
- `useRouter().refresh()` used to revalidate after successful mutations that don't redirect

**Prop patterns:**
- Props always typed with a co-located `interface XxxProps` (not inlined)
- All props destructured in the function signature
- Optional props use `?` with defaults in destructuring: `readOnly = false`, `aiBuilderLocked = false`

**Sub-component extraction:**
- Private sub-components defined as functions in the same file, not exported — `ScoreColumn`, `NavLink`
- These accept strongly-typed prop objects (not spread props)

## Server Action Patterns

Every action file follows this structure:

1. `'use server'` directive at top
2. Shared `getCallerProfile` helper (duplicated per file — not a shared import):
   ```typescript
   async function getCallerProfile(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Profile | null>
   ```
3. Zod schemas defined at module scope for reusable shapes, or inline inside the action for one-off validation
4. `schema.safeParse(...)` for top-level input; `schema.parse(...)` inside try/catch for nested JSON
5. Early returns with `{ error: 'message' }` for auth failures, validation failures, and permission checks
6. `revalidatePath(...)` called after every successful mutation — multiple paths revalidated where data appears in several views
7. Side-effect notifications (Slack/email) fired with `void notifyXxx(...)` to avoid blocking the response

**FormData pattern:**
- Complex nested data (MITs, key results, value ratings) serialized as JSON strings appended to `FormData`, then parsed with Zod on the server:
  ```typescript
  fd.append('review_mits', JSON.stringify(reviewMits))
  // server: z.array(reviewMitSchema).parse(JSON.parse(parsed.data.review_mits))
  ```

## Error Handling Conventions

**Server Actions:** Always return `ActionResult` — never throw. Callers check `'error' in result`.

**Error display in components:**
```tsx
{error && (
  <div className="rounded-[var(--radius-lr)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
    {error}
  </div>
)}
```

**Supabase errors:** Checked via `insertError.code === '23505'` for unique constraint violations. Generic DB errors expose `insertError.message` in the returned `{ error: ... }`.

**Silent failures:** Notification side-effects (Slack/email) use `void notifyXxx(...)` — errors in notifications do not surface to the user.

**Server-side logging:** `console.error('[supabase/server] ...')` used for unexpected DB errors in lib files.

## Styling Conventions

**Tailwind v4** (CSS-first config, no `tailwind.config.ts`).

**LR Design System tokens — mandatory for all UI:**
- Colors: `lr-accent`, `lr-accent-dim`, `lr-border`, `lr-surface`, `lr-surface-2`, `lr-glass`, `lr-text`, `lr-muted`, `lr-bg`, `lr-cyan`, `lr-gold`
- Border radius: `rounded-[var(--radius-lr)]` (default radius), `rounded-[var(--radius-lr-lg)]` (card radius)
- Typography utility classes: `text-section-label`, `text-card-title`, `text-caption` (defined in global CSS)
- Fonts: `--font-display` (Space Grotesk, headings), `--font-sans` (Inter, body)

**`cn()` utility:** Always used when conditionally applying class names:
```typescript
import { cn } from '@/lib/utils'
// cn() is twMerge(clsx(...)) from src/lib/utils.ts
```

**Inline conditional classes pattern (arrays joined):**
```tsx
className={[
  'base classes',
  condition ? 'active classes' : 'inactive classes',
].join(' ')}
```
Both `cn()` and the array-join pattern are used — `cn()` preferred for multi-condition merging, array-join for two-state toggles.

**Component class patterns:**
- Cards/panels: `rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5`
- Error banners: `rounded-[var(--radius-lr)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400`
- Primary action button: `bg-lr-accent hover:bg-lr-accent/90 text-white`
- Outline button: `border-lr-border text-lr-text hover:bg-lr-surface`

**Shadcn components:** Consumed from `src/components/ui/` — `Button`, `Input`, `Textarea`, `Label`, `Dialog`, `Sheet`, `Select`, `Badge`, `Avatar`, `Table`, `Tabs`, `Card`, `DropdownMenu`. Do not import from Radix directly.

## Linting

**Tool:** ESLint 9 with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` (flat config in `eslint.config.mjs`).

**Active suppressions:** `@typescript-eslint/no-explicit-any` is suppressed pervasively (40+ occurrences) due to untyped Supabase client queries. Each suppression has an inline `// eslint-disable-next-line` comment.

**No Prettier config detected.** Formatting is not enforced via config file; consistent indentation (2 spaces) and single-quote strings are observed but not tool-enforced.

## Logging

- `console.error('[module/file] description:', error.message)` — namespace-prefixed, used only for unexpected server-side errors
- No structured logging library
- No application-level `console.log` in production paths

## Module Design

**No barrel files** (`index.ts`) detected. Each module is imported by its full path.

**Actions are grouped by domain** in separate files under `src/lib/actions/`, one file per feature area.

**Types centralized** in `src/lib/types/database.ts` — all domain interfaces and the `Database` type map live here.

---

*Convention analysis: 2026-05-23*
