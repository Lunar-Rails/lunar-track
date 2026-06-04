---
last_mapped_commit: 804cf743d1651aa9bd1d761c60c4d1478e38a540
---

# Testing Patterns

**Analysis Date:** 2026-06-04

## Test Framework

**Runner:**
- Vitest 4.1.7
- Config: Not detected — no `vitest.config.ts` / `vitest.config.mjs`; Vitest defaults apply (Node environment, no global setup file)

**Assertion Library:**
- Vitest built-in `expect` (Chai-compatible)

**Run Commands:**
```bash
npm test              # Run all tests once (vitest run)
npm run test:watch    # Watch mode (vitest)
npx vitest run src/lib/__tests__/reminder-logic.test.ts   # Single file
```

**Current status:** 1 test file, 45 tests, all passing (verified 2026-06-04).

## Test File Organization

**Location:**
- Co-located `__tests__` subdirectory next to source — `src/lib/__tests__/reminder-logic.test.ts` tests `src/lib/reminder-logic.ts`
- Netlify functions and server actions have no tests yet

**Naming:**
- `<module-name>.test.ts` — matches source module name

**Structure:**
```
src/lib/
├── reminder-logic.ts          # Pure functions under test
└── __tests__/
    └── reminder-logic.test.ts # Unit tests
```

**Recommended placement for new tests:**
| Code under test | Test file location |
|-----------------|-------------------|
| `src/lib/<name>.ts` | `src/lib/__tests__/<name>.test.ts` |
| `src/lib/actions/<name>-actions.ts` | `src/lib/actions/__tests__/<name>-actions.test.ts` (not yet used) |
| Shared test helpers | `src/lib/__tests__/helpers/` or `src/test/` (neither exists yet) |

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest'
import { getMonthEnd, isInReminderWindow } from '../reminder-logic'

// ---------------------------------------------------------------------------
// getMonthEnd
// ---------------------------------------------------------------------------
describe('getMonthEnd', () => {
  it('returns the last day of January (31)', () => {
    expect(getMonthEnd(2026, 1).getUTCDate()).toBe(31)
  })
})
```

**Patterns observed in `src/lib/__tests__/reminder-logic.test.ts`:**
- Section dividers with `// ---` comment blocks per exported function
- One `describe` block per function or logical group
- Descriptive `it('…')` strings stating input condition and expected outcome
- Loop-based cases for month/quarter permutations — `for (const m of [3, 6, 9, 12])`
- Fixed UTC ISO date strings — `new Date('2026-01-24T09:00:00Z')` for deterministic calendar math
- No `beforeEach` / `afterEach` — tests are fully isolated pure function calls

## What Gets Tested

**Currently tested:**
- `src/lib/reminder-logic.ts` — calendar window logic, Slack message builders, token parsing (45 cases)

**Design intent for testability:**
- Module header documents: *"Pure functions … No I/O — kept dependency-free for easy unit testing"* — `src/lib/reminder-logic.ts`
- Netlify cron functions import this module — `netlify/functions/slack-reminders.mts`, `netlify/functions/email-reminders.mts`

**Not tested (high-value gaps):**
- All 13 server action modules in `src/lib/actions/`
- Supabase auth / RLS behavior
- React components and forms
- Netlify scheduled functions (`netlify/functions/*.mts`)
- Email notifications (`src/lib/notifications.ts`)
- Slack API wrapper (`src/lib/slack.ts`)

## Mocking

**Framework:** Vitest built-in mocking (`vi.mock`, `vi.spyOn`) — available but **not used** in the existing suite

**Patterns:**
- No mocks in current tests — pure functions only
- No `@vitest/coverage-v8` or MSW installed

**What to Mock (when adding action/integration tests):**
- `@/lib/supabase/server` → `createClient` returning chained query builder stubs
- `next/cache` → `revalidatePath` as no-op
- `next/server` → `after` as synchronous executor or no-op
- External fetch (Mailtrap, Slack, OpenAI) in `src/lib/notifications.ts`, `src/lib/slack.ts`, `src/lib/actions/historical-review-actions.ts`

**What NOT to Mock:**
- Pure logic extracted to `src/lib/` — test directly like `reminder-logic.ts`
- Zod schemas — run real parse/ safeParse against fixture `FormData` values

**Suggested mock skeleton for server actions:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('upsertCheckinEmployee', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns error when not authenticated', async () => {
    // arrange mock supabase with no user
    // act + assert
  })
})
```

## Fixtures and Factories

**Test Data:**
- Inline literals in each test — no shared fixture files yet
- Example token map object in `getTokenForEmail` tests — `src/lib/__tests__/reminder-logic.test.ts`

**Location:**
- Not detected — no `src/test/fixtures/` or factory modules

**Recommendation:** Add typed factories mirroring `src/lib/types/database.ts` interfaces when action tests are introduced:
```typescript
// src/lib/__tests__/factories/profile.ts
import type { Profile } from '@/lib/types/database'

export function buildProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'alice@lunarrails.io',
    full_name: 'Alice',
    role: 'EMPLOYEE',
    // …defaults
    ...overrides,
  }
}
```

## Coverage

**Requirements:** None enforced — no coverage script in `package.json`, no CI gate

**View Coverage:**
- Not configured — would require adding `@vitest/coverage-v8` and a script such as `vitest run --coverage`

**Practical target:** Prioritize pure lib functions and validation logic before UI; server actions second with mocked Supabase

## Test Types

**Unit Tests:**
- Scope: Pure functions in `src/lib/` with no I/O
- Approach: Direct import + `expect` — current sole pattern
- Example: `src/lib/__tests__/reminder-logic.test.ts`

**Integration Tests:**
- Not used
- Candidate scope: Server actions with mocked Supabase client verifying Zod + auth guards + payload shape

**E2E Tests:**
- Not used — no Playwright, Cypress, or `@testing-library/react` in dependencies
- Manual validation per `AGENTS.md`: `npm run dev`, Google OAuth, `tsc`, ESLint

**Component Tests:**
- Not used — no `@testing-library/react` or `jsdom` environment configured

## Type Checking & Lint as Quality Gates

**TypeScript:**
```bash
npx tsc --noEmit
```
- `strict: true` in `tsconfig.json`
- Used as primary static verification alongside tests

**ESLint:**
```bash
npm run lint
```
- ~8 pre-existing errors and ~14 warnings (per project docs) — not treated as test failures

## CI/CD Testing

**CI Pipeline:** Not detected — no `.github/workflows/` in repository

**Deploy validation:** `npm run build` via Netlify (`scripts/netlify-build.sh`) — build-time type check through Next.js compiler, no test step

## Common Patterns

**Async Testing:**
```typescript
it('returns today when no override is provided', () => {
  const before = Date.now()
  const d = getEffectiveDate()
  const after = Date.now()
  expect(d.getTime()).toBeGreaterThanOrEqual(before)
  expect(d.getTime()).toBeLessThanOrEqual(after)
})
```
- Synchronous tests preferred; time-range assertions for `Date.now()`-based functions

**Error / edge-case Testing:**
```typescript
it('returns empty object for invalid JSON', () => {
  expect(parseWorkspaceTokens('not-json')).toEqual({})
})

it('returns null for an unknown domain', () => {
  expect(getTokenForEmail('dave@unknown.com', tokenMap)).toBeNull()
})
```
- Test fallback paths and null returns explicitly

**Parameterized cases:**
```typescript
for (const m of [3, 6, 9, 12]) {
  expect(getReminderType(m)).toBe('quarterly')
}
```

## Adding New Tests — Prescriptive Guide

1. **Extract pure logic first.** If testing calendar, scoring, or validation rules, move them to `src/lib/<name>.ts` with no Supabase imports (follow `reminder-logic.ts`).

2. **Place tests in `__tests__/` adjacent to source.** Name file `<name>.test.ts`.

3. **Use Vitest imports explicitly:**
   ```typescript
   import { describe, it, expect } from 'vitest'
   ```

4. **Prefer UTC-fixed dates** for any date logic — avoid locale-dependent assertions.

5. **Server action tests:** Mock `createClient`, stub `auth.getUser()`, chain `.from().select().eq().single()` returns; assert `{ error }` vs `{ success: true }` — pattern in `src/lib/actions/checkin-actions.ts`.

6. **Do not add a test runner switch** — stay on Vitest (already in `devDependencies`).

7. **Optional vitest config** (when adding jsdom or path aliases):
   ```typescript
   // vitest.config.ts
   import { defineConfig } from 'vitest/config'
   import path from 'path'

   export default defineConfig({
     test: {
       environment: 'node',
     },
     resolve: {
       alias: { '@': path.resolve(__dirname, './src') },
     },
   })
   ```
   Required before component tests can import `@/` paths reliably.

## Environment Notes

**Secrets in tests:** Never read `.env.local` in unit tests; pass overrides as function arguments (see `getEffectiveDate('2026-03-24T09:00:00Z')` and `REMINDER_DATE_OVERRIDE` pattern in Netlify functions).

**Excluded from TypeScript compile:** `pmai`, `netlify` folders in `tsconfig.json` `exclude` — Netlify functions import from `src/lib/` at runtime but are not type-checked by root `tsc`.

---

*Testing analysis: 2026-06-04*
