# Monthly & Quarterly Check-in v2 — Design Spec

**Date:** 2026-05-21  
**Branch:** v2MonthlyQuarterly  
**Status:** Approved

---

## Overview

Redesign both the monthly and quarterly check-in forms to have a clearer two-part structure: a **Review** section (looking back) and a **Plan** section (looking forward). The two forms connect: the Plan section of each form auto-populates the Review section of the next check-in.

---

## Monthly Check-in

### Structure

Two sections, stacked vertically: **Review** on top, **Next Month** below.

### Section 1 — Review

**MITs (Most Important Tasks) — Last Month**

A dynamic list of MITs carried over from the previous month's "Next Month" section (or the quarterly check-in's "First Month MITs" for the first month of a new quarter). Each MIT row displays:

- **Title** (string)
- **What** / description (string)
- **Quarterly OKR link** — either the name of the linked OKR or "Unrelated to quarterly OKRs"
- **Status toggle** — "✓ Achieved" (green) or "✗ Not achieved" (red). Default: Not achieved when first carried over.

An **+ Add MIT** button allows the employee to add additional MITs not pre-populated (e.g. urgent items that came up).

**Done well / Done differently**

Two side-by-side text areas. Free-text, no character limit. Employee fills these in during the check-in.

### Section 2 — Next Month

**MITs for next month**

A dynamic list the employee builds for the upcoming month. Each MIT row has:

- **Title** (string)
- **What** / description (string)
- **Quarterly OKR link** — dropdown populated with the employee's active quarterly OKRs plus a fixed "Unrelated to quarterly OKRs" option at the bottom.

An **+ Add MIT** button adds more rows.

**Auto-carry behaviour:** When this monthly check-in is submitted, all MITs in the Next Month section are written into the Review section of the following month's check-in with status defaulting to "Not achieved".

---

## Quarterly Check-in

### Structure

Two sections, stacked vertically: **Review** on top, **Next Quarter** below.

### Section 1 — Review

**Goal Achievements**

A list of goals set in the previous quarter's "Next Quarter → Goals" section. Each goal row displays:

- **Title** (string)
- **Short description** (string)
- **Status toggle** — "✓ Achieved" (green) or "✗ Not achieved" (red)

Goals are simple text entries, not OKRs. No manager review or approval flow required.

**Done Well / Done Differently**

Read-only panel, auto-aggregated from the employee's three monthly check-ins that fall within this quarter. Displayed as two columns:

- **Done well** — pulls `done_well` from each monthly check-in, labelled with the month name
- **Done differently** — pulls `do_differently` from each monthly check-in, labelled with the month name

If a monthly check-in for that month was not submitted, the slot is omitted silently.

**Values**

Selectable chips for each company value (loaded from the `company_values` table). The employee:

1. Taps chips to toggle which values they demonstrated this quarter (multi-select, no minimum required)
2. For each selected value, a text field expands below the chip list where they write a short description of how they demonstrated it

No numeric rating. No mandatory selection.

### Section 2 — Next Quarter

**Goals**

A dynamic list. Each goal has:

- **Title** (string)
- **Short description** (string)

A **+ New goal** button adds rows. No manager review or approval required. Goals defined here appear in the next quarter's Review → Goal Achievements list.

**First Month MITs**

A dynamic list of MITs for the first month of the upcoming quarter. Each MIT has:

- **Title** (string)
- **What** / description (string)
- **Goal link** — dropdown populated with the goals just defined in this section's Goals list, plus "Unrelated to quarterly goals"

An **+ Add MIT** button adds more rows.

**Auto-carry behaviour:** When this quarterly check-in is submitted, all MITs in "First Month MITs" are written into the Review section of the first monthly check-in of the new quarter, with status defaulting to "Not achieved".

---

## Data Model Changes

### `checkins` table (monthly)

New / changed columns:

| Column | Type | Notes |
|--------|------|-------|
| `mits` | `jsonb` | Array of `{ title, description, okr_id: string \| null, okr_label: string \| null, status: 'achieved' \| 'not_achieved' }` |
| `done_well` | `text` | Existing — keep |
| `do_differently` | `text` | Existing — keep |
| `next_mits` | `jsonb` | Array of `{ title, description, okr_id: string \| null, okr_label: string \| null }` — replaces `mgr_next_mits` as employee-owned |

Legacy fixed MIT columns (`mit_1_title`, `mit_1_description`, etc.) are no longer written to by the new form. Existing data remains readable.

Fields removed from the new form UI (kept in DB for old data):
- `support_requests`
- `ai_builder`
- `mgr_mit_notes`, `mgr_done_well`, `mgr_do_differently`, `mgr_support_commitments`, `mgr_next_mits`

### `quarterly_checkins` table

New / changed columns:

| Column | Type | Notes |
|--------|------|-------|
| `goals` | `jsonb` | Array of `{ id: uuid, title, description, status: 'achieved' \| 'not_achieved' \| null }` — replaces OKR progress narratives for review |
| `next_quarter_goals` | `jsonb` | Array of `{ id: uuid, title, description }` — goals set for next quarter |
| `next_quarter_mits` | `jsonb` | Array of `{ title, description, goal_id: string \| null, goal_label: string \| null }` |
| `value_assessments` | `jsonb` | Array of `{ value_id, value_name, description: string }` — replaces `value_self_assessments` (no rating) |

Existing fields `continue_doing`, `stop_doing`, `start_doing`, `okr_progress`, `okr_adjustments`, `capability_needs` are no longer written to by new form UI (kept in DB for old data).

### MIT `Mit` type (shared)

```typescript
// Review MIT (monthly check-in review section)
interface ReviewMit {
  title: string
  description: string
  okr_id: string | null       // null = unrelated
  okr_label: string | null    // display name snapshot
  status: 'achieved' | 'not_achieved'
}

// Plan MIT (monthly next-month or quarterly first-month)
interface PlanMit {
  title: string
  description: string
  okr_id: string | null
  okr_label: string | null
}
```

---

## Auto-Carry Logic

### Monthly → Monthly carry

On successful submission of a monthly check-in, a server action checks if a check-in record already exists for the following month. If not, it creates a draft record and sets `mits` to the submitted `next_mits` array with all statuses set to `not_achieved`.

If a draft already exists (employee started the next month's check-in early), the `mits` field is **overwritten** with the new carry-over data.

### Quarterly → Monthly carry (first month of new quarter)

On successful submission of a quarterly check-in, the same carry logic applies: `next_quarter_mits` is written as `mits` to the first monthly check-in of the new quarter (month = 1 of the new period).

### Goal carry (quarterly → quarterly)

On submission, `next_quarter_goals` is stored on the current quarterly check-in record. When the next quarter's check-in is created, a server action reads the previous quarterly check-in and populates `goals` from the previous `next_quarter_goals` (with `status: null` on each, ready for the employee to mark).

---

## Components to Create / Modify

| Component | Action | Notes |
|-----------|--------|-------|
| `EmployeeCheckinForm.tsx` | Rewrite | New two-section layout |
| `QuarterlyCheckinEmployeeForm.tsx` | Rewrite | New two-section layout, values chips |
| `MitReviewList.tsx` | Create | Reusable MIT list for review section (achieved toggle) |
| `MitPlanList.tsx` | Create | Reusable MIT list for plan section (OKR/goal link dropdown) |
| `ValueChipSelector.tsx` | Create | Multi-select chips + expanding description fields |
| `GoalAchievementList.tsx` | Create | Quarterly goal list with ✓/✗ toggle |
| `MonthlyDoneWellSummary.tsx` | Create | Read-only aggregate of 3 monthly check-ins' done_well / do_differently |
| `checkin-actions.ts` | Modify | Add carry logic on submit |
| `quarterly-checkin-actions.ts` | Modify | Add carry logic on submit, new field handling |

---

## Out of Scope

- Manager review sections (not changed in this spec)
- OKR creation / management flow (unchanged)
- Notification or reminder system
- Historical data migration for old fixed MIT columns
