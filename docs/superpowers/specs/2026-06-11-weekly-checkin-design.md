# Weekly Check-in (Beta) — Design Spec

**Date:** 2026-06-11
**Status:** Approved (design) — pending spec review
**Author:** Max (+ Claude)

## Summary

Add a lightweight **Weekly Check-in** in a **3Ps** format (Progress, Plan, Problem),
filled weekly by the employee and visible read-only to their manager. A **monthly
roll-up** of the month's weekly check-ins appears, read-only, inside the monthly
check-in so the monthly conversation has weekly context.

Shipped as **Beta** — a new tab alongside Monthly/Quarterly, labeled "(Beta)",
available to all employees.

## Goals

- Give employees a frictionless weekly cadence to capture progress, plan, and blockers.
- Connect each week's plan to the month's committed MITs (so weekly work ladders up).
- Surface a monthly highlights roll-up inside the monthly check-in for the 1:1.

## Non-goals (out of scope for Beta)

- Weekly email reminders / cron (the existing reminder cron is monthly/quarterly only).
- Manager comments/notes on weekly entries.
- Analytics / scoring on weekly data.
- A formal submit/approval step (weekly is save-only — see Decisions).

## Participants & visibility

- **Employee writes** their own weekly check-ins.
- **Manager views** (read-only) their direct/indirect reports' weekly check-ins.
- **HR Admin** can read all.
- Enforced at the DB layer via RLS, reusing the existing helpers
  (`private.is_in_my_subtree`, `private.is_hr_admin`) — identical model to `checkins`.

## Week model

- A week is **Monday–Friday** (work week); one check-in per ISO week.
- Identified by `week_start` = that week's **Monday** (a `date`).
- A new entry defaults to the **current** week.
- Roll-up to a month is by the **month of `week_start`** (the Monday). Weeks that
  straddle a month boundary count toward the month their Monday falls in.

## The 3Ps form

Route: `/weekly-checkins/new` (create, defaults to current week) and
`/weekly-checkins/[id]` (read view + Edit, mirroring the goals/monthly pattern).

1. **Progress** — free text. "Update from last week."
2. **Plan** — up to **2** task rows (UI prevents adding a 3rd). Each row:
   - `title` (text)
   - optional link to **one of this month's MITs** via a dropdown, or "Not linked".
     The dropdown is populated from the employee's **current monthly check-in's
     committed MITs** (`checkins.mits` for the current month/year). If there is no
     current monthly check-in, the dropdown shows only "Not linked".
3. **Problem** — free text, with a sub-field **"Last-minute requests this week"**.

## Data model — `weekly_checkins` (migration `00036`)

```
weekly_checkins
  id                    uuid pk default gen_random_uuid()
  employee_id           uuid not null references profiles(id) on delete cascade
  week_start            date not null            -- the Monday of the work week
  progress              text
  plan_tasks            jsonb not null default '[]'  -- max 2; [{title, mit_id|null, mit_label|null}]
  problems              text
  last_minute_requests  text
  created_at            timestamptz not null default now()
  updated_at            timestamptz not null default now()
  unique (employee_id, week_start)
```

- `plan_tasks` mirrors the shape of `checkins.next_mits` (title + optional link),
  so the linking UI/component can be reused/adapted. `mit_label` is denormalized
  for display (like `okr_label` on MITs today).
- Index: `(employee_id, week_start desc)` for listing and roll-up queries.

### RLS (mirrors `checkins`)

- `weekly_self_rw` — employee can SELECT/INSERT/UPDATE/DELETE own rows
  (`employee_id = (select auth.uid())`).
- `weekly_manager_read` — SELECT where `private.is_in_my_subtree(employee_id)`.
- `weekly_hr_read` — SELECT where `private.is_hr_admin()`.

## Server actions (`src/lib/actions/weekly-actions.ts`)

- `upsertWeeklyCheckin(formData)` — validates with Zod (tolerant parse like the
  MIT fix: coerce null/over-long, max 2 plan tasks), upserts by
  `(employee_id, week_start)`. Save-only (no submit flag). Revalidates
  `/checkins` and the current monthly check-in path.
- Reuse tolerant `boundedText` style parsing for `plan_tasks`/text fields.

## Monthly roll-up (in the monthly check-in)

A read-only **"Weekly highlights this month"** section rendered in the monthly
check-in (`EmployeeCheckinForm` review tab), visible to both employee and the
manager viewing it.

Computed for the monthly check-in's `(month, year)`:

- Query the employee's `weekly_checkins` whose `week_start` falls in that month.
- **Problems & last-minute requests** — list the non-empty entries across the
  month's weeks (each tagged with its week start).
- **MIT coverage** — the distinct `mit_id`s referenced by the month's weekly plan
  tasks, mapped to the month's MIT titles → show which monthly MITs were touched
  by weekly plans and which were not.
- **Count** — number of weekly check-ins logged that month.

This is aggregated highlights (the "so what"), not a full per-week transcript.

## Navigation

- Add a third tab **"Weekly (Beta)"** to `/checkins` (alongside Monthly /
  Quarterly). Lists the employee's weekly check-ins, newest first, with a
  "New weekly check-in" button (creates/opens the current week).
- Routes: `/weekly-checkins/new`, `/weekly-checkins/[id]`.

## Decisions (confirmed)

- **Save-only**, no submit/draft step — keeps the weekly habit frictionless;
  manager sees saved entries.
- **Beta = visible to all employees**, tab labeled "(Beta)". No role gating.
- **Week = Monday–Friday**, one per ISO week, rolled to month by the Monday.
- **Plan tasks link to this month's monthly MITs** via a dropdown.
- **Monthly roll-up = aggregated highlights** (problems + last-minute requests +
  MIT coverage + count), read-only.

## Testing

- Unit: `plan_tasks` parsing (max 2, null/over-long tolerance), week_start
  computation (Monday of a given date), month roll-up grouping (straddling weeks).
- RLS: employee can CRUD own; manager can read subtree, not write; non-manager
  cannot read others (rolled-back SQL tests, as used for the profiles RLS fix).
- Build/typecheck/lint green; manual: create a weekly check-in, link a plan task
  to a monthly MIT, confirm it appears in the monthly roll-up.

## Open questions / risks

- "This month's MITs" source = current monthly check-in's `mits`. If the employee
  hasn't created a monthly check-in yet, the link dropdown is empty (acceptable).
- Straddling weeks: a Mon–Fri week is always within one month except when the
  Monday and Friday differ in month at a boundary — we attribute by the Monday,
  which is simple and predictable.
