# UI Audit — LunarTrack
**Date:** 2026-05-23
**Auditor:** gsd-ui-auditor
**Screenshots:** Not captured (code-only audit)
**Baseline:** LR Design System tokens defined in `src/app/globals.css`

---

## Pillar Scores

| Pillar | Score (1-4) | Notes |
|--------|-------------|-------|
| Design System Compliance | 2/4 | Multiple hardcoded raw Tailwind color classes throughout; login page is fully off-token |
| Component Consistency | 3/4 | Shadcn used consistently; one raw `<select>` and one raw `<input type="checkbox">` bypass the component library |
| Responsive Design | 2/4 | No mobile nav collapse; fixed sidebar at 224px breaks at all mobile viewports; no overflow wrapper on scoring table |
| Accessibility | 2/4 | Inbox icon-button uses `title` not `aria-label`; raw checkbox has no visible focus ring; confirm()/alert() dialogs are not accessible |
| Empty/Error States | 3/4 | Empty states present on all lists; error display is inconsistent — mixed token/raw colors in error divs |
| UX Consistency | 3/4 | Destructive actions use browser `confirm()` and `alert()` rather than confirmation dialogs |
| **Overall** | **15/24** | |

---

## Top Priority Fixes

1. **Login page and OkrForm use fully raw Tailwind color palette** — Users loading the app for the first time see a light gray/white background instead of the LR dark-glass aesthetic. Fix: replace all `bg-gray-*`, `bg-white`, `text-gray-*`, `border-gray-*`, `bg-red-*`, `bg-amber-*`, `bg-violet-*` with LR design tokens.

2. **Fixed sidebar has no mobile breakpoint — layout is broken below ~700px** — `StandardLayout` hard-codes `ml-56` on `<main>` and the sidebar is `fixed left-0 top-14 bottom-0 w-56` with no responsive variant. Fix: add `hidden md:block` to Sidebar, `md:ml-56` to main, introduce a mobile hamburger Sheet using the already-installed Shadcn Sheet.

3. **Score labels inverted between scoring form and employee-facing view** — `QuarterlyScoringForm` maps `1=Outstanding` while `my-performance/page.tsx` maps `1=Significantly below expectations`. These are contradictory. Fix: align on one shared `SCORE_LABELS` constant.

---

## Detailed Findings

### Pillar 1: Design System Compliance (2/4)

**[UI-01] Login page uses raw Tailwind colors throughout**
**Severity:** Critical
**Files:** `src/app/login/page.tsx:28-69`, `src/components/auth/MagicLinkForm.tsx:42-67`

Violations:
- `bg-gray-50` → `bg-lr-bg`
- `bg-white` → `bg-lr-glass` or `bg-lr-surface`
- `border-gray-200` → `border-lr-border`
- `text-gray-500/400/600/800` → `text-lr-muted` / `text-lr-text`
- `border-red-200 bg-red-50 text-red-600` → `border-lr-error/20 bg-lr-error-dim text-lr-error`
- `border-amber-200 bg-amber-50 text-amber-700` → `border-lr-warning-dim bg-lr-warning-dim text-lr-warning`
- `border-violet-200 bg-violet-50 text-violet-700` → `border-lr-accent/20 bg-lr-accent-dim text-lr-accent`
- MagicLinkForm input: `bg-white border-gray-300 text-gray-900 focus:border-violet-500` → `bg-lr-surface border-lr-border text-lr-text focus:ring-lr-accent`

---

**[UI-02] OkrForm uses raw bg-white on input fields and raw error colors**
**Severity:** Warning
**File:** `src/components/okrs/OkrForm.tsx:64,66,74,81-83`

- `bg-white` on Input/Textarea → `bg-lr-surface`
- `bg-red-50 border-red-200 text-red-600` → `bg-lr-error-dim border-lr-error/20 text-lr-error`
- `text-red-500` → `text-lr-error`

---

**[UI-03] StickyAdminHeader uses raw bg-white and border-gray-100**
**Severity:** Warning
**File:** `src/components/admin/StickyAdminHeader.tsx:22`

`bg-white border-gray-100` → `bg-lr-bg border-lr-border`. Renders a white bar at top of the admin settings page in dark mode, completely breaking the glass aesthetic.

---

**[UI-04] Dashboard: raw green-500 / red-400 for goal status indicators**
**Severity:** Warning
**File:** `src/app/(protected)/dashboard/page.tsx:388-399`

`bg-green-500`, `text-green-400`, `text-red-400`, `bg-red-400` → `bg-lr-success`, `text-lr-success`, `text-lr-error`.

---

**[UI-05] Dashboard urgency badge uses raw red-500**
**Severity:** Warning
**File:** `src/app/(protected)/dashboard/page.tsx:264-270`

`bg-red-500/10 text-red-400 border-red-500/20` → `bg-lr-error-dim text-lr-error border-lr-error/20`.

---

**[UI-06] Team page and analytics page use raw green-500/red-500 colors**
**Severity:** Warning
**Files:** `src/app/(protected)/team/page.tsx:27-28`, `src/app/(protected)/analytics/page.tsx:263,317-319`

`bg-green-500/15 text-green-400 border-green-500/25`, `bg-red-500/10 text-red-400`, `bg-green-500`, `bg-red-500` → LR success/error tokens throughout.

---

**[UI-07] QuarterlyScoringForm uses raw green-400/red-400 for MIT status**
**Severity:** Warning
**File:** `src/components/performance/QuarterlyScoringForm.tsx:287,328-330`

`bg-green-400`, `text-green-400`, `text-red-400` → `bg-lr-success`, `text-lr-success`, `text-lr-error`.

---

**[UI-08] AI Builder checkbox uses hardcoded hex accent**
**Severity:** Info
**File:** `src/components/performance/QuarterlyScoringForm.tsx:228`

`accent-[#7c5cfc]` → use `var(--lr-accent)` via a CSS class or the token directly.

---

**[UI-09] EmployeeCheckinForm error divs use raw red-500**
**Severity:** Warning
**File:** `src/components/checkins/EmployeeCheckinForm.tsx:205,229`

`border-red-500/20 bg-red-500/10 text-red-400` → `border-lr-error/20 bg-lr-error-dim text-lr-error`.

---

**[UI-10] UsersTable sticky filter bar uses bg-white**
**Severity:** Warning
**File:** `src/components/admin/UsersTable.tsx:85`

`bg-white` on sticky filter+column-header block → `bg-lr-bg`. Fails in dark mode.

---

### Pillar 2: Component Consistency (3/4)

**[UI-11] OnboardingForm uses raw native `<select>` instead of Shadcn Select**
**Severity:** Warning
**File:** `src/components/onboarding/OnboardingForm.tsx:61-77`

Native `<select>` for manager selection won't match the Radix Select visual system (no custom chevron, no dropdown animation, different focus ring). Should use Shadcn `Select` as used in `UsersTable` and `RoleSelect`.

---

**[UI-12] QuarterlyScoringForm uses raw `<input type="checkbox">` instead of Shadcn Checkbox**
**Severity:** Warning
**File:** `src/components/performance/QuarterlyScoringForm.tsx:222-230`

Bare `<input type="checkbox">` with `accent-[#7c5cfc]`. Radix Checkbox is available as a peer dep. Creates inconsistency in interactive element style.

---

**[UI-13] OkrForm uses bare `<label>` instead of Shadcn Label**
**Severity:** Info
**File:** `src/components/okrs/OkrForm.tsx:59,69`

`<label className="text-section-label">` — should use Shadcn `<Label>` component as used in EmployeeCheckinForm, MagicLinkForm, etc.

---

### Pillar 3: Responsive Design (2/4)

**[UI-14] Sidebar has no mobile breakpoint — layout broken on all mobile viewports**
**Severity:** Critical
**Files:** `src/components/layout/StandardLayout.tsx:17`, `src/components/layout/Sidebar.tsx:52`

Sidebar is `fixed left-0 top-14 bottom-0 w-56` with no responsive variant. `<main>` has `ml-56` with no responsive variant. On viewports narrower than ~700px the sidebar overlaps all page content. The Shadcn `Sheet` component is already installed at `src/components/ui/sheet.tsx`.

**Fix:**
- `Sidebar.tsx`: add `hidden md:flex` (or `hidden md:block`) to the sidebar container
- `StandardLayout.tsx`: change `ml-56` to `md:ml-56`
- Add a `MobileNav` component using `Sheet` triggered by a hamburger button in `Header.tsx`

---

**[UI-15] Quarterly scoring table has no horizontal scroll wrapper on mobile**
**Severity:** Warning
**File:** `src/app/(protected)/team/page.tsx:353`

`<table>` with no `overflow-x-auto` parent. The analytics employee leaderboard (analytics/page.tsx:247) does have `overflow-x-auto` — this one was missed.

---

**[UI-16] Analytics stat cards jump from 2-col to 4-col with no sm: intermediate**
**Severity:** Info
**File:** `src/app/(protected)/analytics/page.tsx:184`

`grid-cols-2 lg:grid-cols-4` — consider `sm:grid-cols-2 md:grid-cols-4` for tablet.

---

### Pillar 4: Accessibility (2/4)

**[UI-17] Inbox icon button uses `title` not `aria-label`**
**Severity:** Warning
**File:** `src/components/layout/Header.tsx:51-55`

`title="Inbox · 3 pending"` is not reliably announced by screen readers and is not visible on touch. Should be `aria-label`.

---

**[UI-18] `confirm()` and `alert()` used for destructive actions — inaccessible**
**Severity:** Warning
**Files:** `src/components/admin/UsersTable.tsx:68`, `src/components/okrs/DeleteGoalButton.tsx:14,20`

`confirm()` and `alert()` are not accessible to screen readers, blocked in sandboxed iframes, and break the visual design contract. Replace with Shadcn `AlertDialog`.

---

**[UI-19] "Remove" button in UsersTable has no per-row accessible name**
**Severity:** Info
**File:** `src/components/admin/UsersTable.tsx:192-199`

Should be `aria-label={`Remove ${u.full_name ?? u.email}`}` so screen readers identify which user is being removed.

---

**[UI-20] Raw checkbox for AI Builder has no visible custom focus indicator**
**Severity:** Warning
**File:** `src/components/performance/QuarterlyScoringForm.tsx:222`

Browser default focus ring on a checkbox may not meet WCAG 2.1 AA focus-visibility requirements. Use Shadcn Checkbox (see UI-12).

---

**[UI-21] Error messages not associated with their triggering field via aria-describedby**
**Severity:** Warning
**Files:** `src/components/okrs/OkrForm.tsx:66`, `src/components/onboarding/OnboardingForm.tsx:81`, `src/components/auth/MagicLinkForm.tsx:55`

Error `<p>` tags not linked to their input via `aria-describedby`. Screen readers won't associate the error with the field.

---

### Pillar 5: Empty/Error States (3/4)

Empty states are consistently implemented across all list/table views with the correct LR glass pattern.

**[UI-22] Error display uses 3 different visual styles across the codebase**
**Severity:** Warning

- `border-red-500/20 bg-red-500/10 text-red-400` — EmployeeCheckinForm, QuarterlyScoringForm
- `bg-red-50 border-red-200 text-red-600` — login page, OkrForm (light-mode raw)
- `text-red-400` / `text-red-500` bare — OkrForm, OnboardingForm

Fix: standardise on a single `ErrorBanner` component using `bg-lr-error-dim border-lr-error/20 text-lr-error`.

---

**[UI-23] No global error boundary**
**Severity:** Warning

No `error.tsx` or `global-error.tsx` in the app directory. Unhandled Server Component exceptions surface Next.js default error UI. Add `src/app/(protected)/error.tsx` with branded error UI.

---

**[UI-24] No loading.tsx — blank screen on navigation**
**Severity:** Warning

All protected pages use `force-dynamic` with `await` DB calls but no Suspense boundaries or `loading.tsx`. Users see a blank screen while data loads. Add `src/app/(protected)/loading.tsx` with a spinner.

---

### Pillar 6: UX Consistency (3/4)

**[UI-25] Destructive actions use browser dialogs instead of in-app confirmation**
**Severity:** Warning
**Files:** `src/components/admin/UsersTable.tsx:68`, `src/components/okrs/DeleteGoalButton.tsx:14`

See UI-18. Replace `confirm()` with Shadcn `AlertDialog` for styled, accessible confirmations.

---

**[UI-26] Delete goal error uses `alert()` inconsistently with rest of app**
**Severity:** Warning
**File:** `src/components/okrs/DeleteGoalButton.tsx:20`

`alert(result.error)` — should set inline error state and render it, consistent with every other error pattern in the app.

---

**[UI-27] Score labels INVERTED between scoring form and employee performance view**
**Severity:** Critical (data correctness)
**Files:** `src/components/performance/QuarterlyScoringForm.tsx:22-27`, `src/app/(protected)/my-performance/page.tsx:7-13`

- `QuarterlyScoringForm`: `1 = "Outstanding"`, `5 = "Significantly below expectations"`
- `my-performance/page.tsx`: `1 = "Significantly below expectations"`, `5 = "Outstanding"`

The same score number displays opposite labels to managers vs. employees. Fix: export a single `SCORE_LABELS` constant from a shared util and import it in both files.

---

**[UI-28] No loading.tsx route segment**
**Severity:** Warning

See UI-24. Add `src/app/(protected)/loading.tsx`.

---

**[UI-29] Page title metadata not set on protected pages**
**Severity:** Info

Root layout sets `title: 'CiaoBob'`. No protected page exports `generateMetadata`. All tabs share the same title. Add page-level metadata to key pages.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 3 (UI-01, UI-14, UI-27) |
| Warning | 19 |
| Info | 5 |
| **Total** | **27** |

*Audit date: 2026-05-23*
