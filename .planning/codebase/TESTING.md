# Testing Patterns

**Analysis Date:** 2026-05-23

## Test Framework

**Runner:**
- Vitest 4.1.7
- Config: no dedicated `vitest.config.*` file detected — Vitest runs with defaults (reads from `package.json`)

**Assertion Library:**
- Vitest built-in (`expect`) with `describe` / `it` from `vitest`

**Run Commands:**
```bash
npm run test          # vitest run (single pass, CI mode)
npm run test:watch    # vitest (watch mode)
```

No coverage command is configured in `package.json` scripts.

## Test File Organization

**Location:**
- Co-located under `src/lib/__tests__/` — a dedicated `__tests__` directory adjacent to the lib modules being tested

**Naming:**
- `<module-name>.test.ts` — e.g., `reminder-logic.test.ts`

**Current test files (total: 1):**
- `src/lib/__tests__/reminder-logic.test.ts` — tests pure utility functions exported from `src/lib/reminder-logic.ts`

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest'
import { functionUnderTest } from '../module-name'

describe('functionName', () => {
  it('descriptive assertion in plain English', () => {
    expect(functionUnderTest(input)).toBe(expectedValue)
  })
})
```

Each exported function gets its own `describe` block with a header comment:
```typescript
// ---------------------------------------------------------------------------
// functionName
// ---------------------------------------------------------------------------
describe('functionName', () => { ... })
```

**Patterns:**
- No `beforeEach` / `afterEach` / `beforeAll` — tests are stateless pure-function calls
- No async tests — all tested functions are synchronous
- Parameterized cases done with `for...of` loops inside `it` blocks, not `it.each`

## What IS Tested

**`src/lib/reminder-logic.ts`** — thoroughly covered (279 lines of tests):
- `getMonthEnd` — correct last day for all month lengths including leap years
- `isReminderDay` — 7-days-before-month-end logic for 31-day, 30-day, and February (leap/non-leap)
- `getReminderType` — monthly vs quarterly classification by month number
- `getQuarterForMonth` — correct Q1–Q4 mapping for all 12 months
- `getReminderPeriod` — composite object shape and values
- `buildReminderMessage` — Slack Block Kit structure, correct URLs, deadline date in text
- `parseWorkspaceTokens` — valid JSON, invalid JSON, wrong shape, non-string values
- `getTokenForEmail` — domain matching, case-insensitivity, unknown domain, malformed email, empty map
- `getEffectiveDate` — current date fallback, valid ISO override, invalid override fallback

## What Is NOT Tested (Coverage Gaps)

**Server Actions (all untested):**
- `src/lib/actions/checkin-actions.ts` — `upsertCheckinEmployee`, `carryMitsToNextMonth`
- `src/lib/actions/okr-actions.ts` — `createOkr`, `updateOkr`, `deleteOkr`, `transitionOkrStatus`
- `src/lib/actions/performance-actions.ts` — `upsertQuarterlyScore`, `toggleScoreVisibility`, `finalizeAnnualScore`
- `src/lib/actions/quarterly-checkin-actions.ts`
- `src/lib/actions/onboarding-actions.ts`
- `src/lib/actions/user-actions.ts`
- `src/lib/actions/admin-actions.ts`
- `src/lib/actions/period-actions.ts`
- `src/lib/actions/guide-actions.ts`
- `src/lib/actions/okr-progress-actions.ts`

**Auth and middleware:**
- `src/lib/supabase/server.ts` — `getOrProvisionProfile` not tested
- `src/lib/auth/allowed-domains.ts` — not tested
- `src/proxy.ts` — not tested

**Notifications:**
- `src/lib/notifications.ts` — not tested
- `src/lib/slack.ts` — not tested

**UI components (all untested):**
- No component tests (no React Testing Library, no Playwright, no Storybook)
- All of `src/components/**` is untested

**Business logic in pages:**
- All `src/app/(protected)/**/page.tsx` files — data fetching and role-based rendering untested

**Critical untested paths:**
- OKR state machine transitions (`TRANSITIONS` map in `okr-actions.ts`) — no test for invalid transitions
- AI Builder gate enforcing B/V score cap at 4 in `upsertQuarterlyScore`
- `carryMitsToNextMonth` — MIT carry-forward logic after check-in submission
- Annual score averaging via `compute_annual_averages` RPC
- Org closure permission checks (manager-only actions)
- Onboarding redirect guard in `src/app/(protected)/layout.tsx`

## E2E / Integration Split

- **Unit tests:** 1 file covering pure utility functions
- **Integration tests:** None
- **E2E tests:** None — no Playwright, Cypress, or similar configured
- **Component tests:** None — no React Testing Library or equivalent

## Test Utilities / Helpers

None. Tests import directly from the module under test with no shared fixtures, factories, or mock utilities.

## Coverage

**Requirements:** None enforced. No coverage threshold configured, no `--coverage` script in `package.json`.

**Estimated coverage by area:**
- `src/lib/reminder-logic.ts`: high — all exported functions covered
- `src/lib/actions/*`: 0%
- `src/components/*`: 0%
- `src/app/*`: 0%
- `src/lib/supabase/*`: 0%
- `src/lib/notifications.ts`: 0%

## Overall Test Quality Assessment

**Current state:** Minimal. One well-written test file covers one pure utility module. The core application logic — Server Actions, auth flows, permission checks, data mutations — has zero test coverage.

**Strengths of the existing test:**
- Covers edge cases thoroughly (leap years, boundary months, malformed inputs)
- Tests are descriptive and self-documenting
- No external dependencies or mocks needed (pure functions)

**Critical gaps:**
- The OKR status machine, quarterly scoring rules, MIT carry-forward, and annual score computation are entirely untested business rules
- No smoke tests or integration tests verify that Server Actions reach the database correctly
- No auth boundary tests confirm role enforcement (EMPLOYEE vs MANAGER vs HR_ADMIN) at the action level

**Recommended additions in priority order:**
1. Unit tests for Server Action business logic (mock Supabase client) — especially `transitionOkrStatus`, `upsertQuarterlyScore`, and `carryMitsToNextMonth`
2. Integration tests for the auth guard in `src/app/(protected)/layout.tsx`
3. E2E smoke tests for the happy path of check-in submission and quarterly scoring

---

*Testing analysis: 2026-05-23*
