# Manager Improvements A — Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 8 high-value manager UX improvements across check-in forms, inbox, and the dashboard without any new pages or heavy DB work.

**Architecture:** Most changes are client-side form enhancements (read existing data → render as context) or UI restructuring. The one DB change (private notes) adds two nullable TEXT columns to existing tables via Supabase MCP. Dashboard revision restructures existing data into a cleaner employee-first layout. All "Goal" references replace any remaining "OKR" labels in user-facing strings; internal DB columns/TS field names stay unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 + LR Design System, Supabase SSR, Server Actions, TypeScript. No new dependencies.

---

## File Map

| File | Change |
|---|---|
| `src/lib/types/database.ts` | Add `mgr_private_note` to `Checkin` and `QuarterlyCheckin` |
| `src/lib/actions/checkin-actions.ts` | Handle `mgr_private_note` in `upsertCheckinManager` |
| `src/lib/actions/quarterly-checkin-actions.ts` | Handle `mgr_private_note` in `upsertQuarterlyCheckinManager` |
| `src/components/checkins/ManagerCheckinForm.tsx` | Pre-fill MITs from employee plan, show employee MITs as context, add private note field |
| `src/components/checkins/QuarterlyCheckinManagerForm.tsx` | Show employee goals with achieved/not status, add private note field |
| `src/app/(protected)/checkins/[checkinId]/page.tsx` | Pass `employeeNextMits` prop to `ManagerCheckinForm` |
| `src/app/(protected)/inbox/page.tsx` | Group items by urgency (overdue vs this week vs older) |
| `src/app/(protected)/dashboard/page.tsx` | Revise employee card (next action + deadline), revise manager card (pending counts), fix OKR→Goal labels |

---

## Task 1: DB migration — add `mgr_private_note` columns

**Files:**
- Supabase MCP migration (no local file)
- Modify: `src/lib/types/database.ts:131-146` (Checkin manager section)
- Modify: `src/lib/types/database.ts:200-210` (QuarterlyCheckin manager section)

- [ ] **Step 1: Apply migration via Supabase MCP**

Run this SQL (use `mcp__82884827-2313-48e7-b432-a0f7e950996c__execute_sql`):
```sql
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS mgr_private_note TEXT;

ALTER TABLE quarterly_checkins
  ADD COLUMN IF NOT EXISTS mgr_private_note TEXT;
```

Expected: both ALTER TABLE succeed with no error.

- [ ] **Step 2: Update TypeScript types**

In `src/lib/types/database.ts`, add to the `Checkin` interface manager section (after `mgr_support_commitments`):
```typescript
  mgr_private_note: string | null
```

Add to `QuarterlyCheckin` interface manager section (after `mgr_support_plan`):
```typescript
  mgr_private_note: string | null
```

- [ ] **Step 3: Verify types compile**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track" && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track"
git add src/lib/types/database.ts
git commit -m "feat(db): add mgr_private_note to checkins and quarterly_checkins"
```

---

## Task 2: Monthly manager form — show employee's plan MITs as read-only context

The employee fills `checkin.next_mits` (their plan for next month). The manager should see these as a starting reference while writing their own next-month MITs section.

**Files:**
- Modify: `src/components/checkins/ManagerCheckinForm.tsx`

The component already receives `checkin: Checkin`. `checkin.next_mits` is `PlanMit[] | null`.

- [ ] **Step 1: Add employee context panel above the Next Month's MITs section**

In `src/components/checkins/ManagerCheckinForm.tsx`, add the import for `PlanMit`:
```typescript
import type { Checkin, Mit, PlanMit } from '@/lib/types/database'
```

Then inside the JSX, add this block immediately **before** the `<section>` for "Next Month's MITs":

```tsx
{/* Employee's planned MITs — read-only context */}
{(checkin.next_mits ?? []).filter((m) => m.title.trim()).length > 0 && (
  <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-4 space-y-2">
    <p className="text-xs font-semibold text-lr-text">Employee's planned commitments for next month</p>
    <p className="text-[11px] text-lr-muted">These are what the employee committed in their plan tab. Use as a starting point.</p>
    <ul className="space-y-1.5 mt-2">
      {(checkin.next_mits ?? []).filter((m) => m.title.trim()).map((m, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="text-[11px] font-mono text-lr-accent shrink-0 mt-0.5">{i + 1}</span>
          <div>
            <p className="text-xs text-lr-text font-medium">{m.title}</p>
            {m.description && <p className="text-[11px] text-lr-muted">{m.description}</p>}
            {m.okr_label && <p className="text-[11px] text-lr-accent/70 mt-0.5">Goal: {m.okr_label}</p>}
          </div>
        </li>
      ))}
    </ul>
  </div>
)}
```

- [ ] **Step 2: Verify the panel renders only when employee has planned MITs**

Check that the condition `filter((m) => m.title.trim()).length > 0` means no panel renders for empty arrays.

- [ ] **Step 3: Commit**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track"
git add src/components/checkins/ManagerCheckinForm.tsx
git commit -m "feat(manager): show employee's planned MITs as read-only context in manager form"
```

---

## Task 3: Pre-fill manager's next-month MITs from employee's plan

When the manager hasn't written any MITs yet (`mgr_next_mits` is empty/null), default to the employee's `next_mits` as a starting point rather than a blank row.

**Files:**
- Modify: `src/components/checkins/ManagerCheckinForm.tsx`

- [ ] **Step 1: Update `initNextMits` to fall back to employee's plan**

Replace the existing `initNextMits` function:

```typescript
function initNextMits(checkin: Checkin): Mit[] {
  // Existing manager draft takes priority
  if (checkin.mgr_next_mits && checkin.mgr_next_mits.length > 0) return checkin.mgr_next_mits
  // Legacy fixed fields
  const result: Mit[] = []
  if (checkin.mgr_next_mit_1_title) result.push({ title: checkin.mgr_next_mit_1_title, description: checkin.mgr_next_mit_1_description ?? '' })
  if (checkin.mgr_next_mit_2_title) result.push({ title: checkin.mgr_next_mit_2_title, description: checkin.mgr_next_mit_2_description ?? '' })
  if (checkin.mgr_next_mit_3_title) result.push({ title: checkin.mgr_next_mit_3_title, description: checkin.mgr_next_mit_3_description ?? '' })
  if (result.length > 0) return result
  // NEW: fall back to employee's planned next_mits as pre-fill
  if (checkin.next_mits && checkin.next_mits.length > 0) {
    const prefilled = checkin.next_mits
      .filter((m) => m.title.trim())
      .map((m) => ({ title: m.title, description: m.description }))
    if (prefilled.length > 0) return prefilled
  }
  return [{ title: '', description: '' }]
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track"
git add src/components/checkins/ManagerCheckinForm.tsx
git commit -m "feat(manager): pre-fill next-month MITs from employee's plan when manager has no draft"
```

---

## Task 4: Add private note to monthly manager form

A manager-only textarea that employees can never see. Saved to `mgr_private_note`. The server action must never include this field in any employee-facing query result.

**Files:**
- Modify: `src/components/checkins/ManagerCheckinForm.tsx`
- Modify: `src/lib/actions/checkin-actions.ts`

- [ ] **Step 1: Add `mgr_private_note` to form state**

In `ManagerCheckinForm`, add to state:
```typescript
const [privateNote, setPrivateNote] = useState(checkin.mgr_private_note ?? '')
```

Add to the Zod schema (already uses `useForm` — add field alongside existing ones):
```typescript
const schema = z.object({
  mgr_mit_notes: z.string().max(3000).optional(),
  mgr_done_well: z.string().max(3000).optional(),
  mgr_do_differently: z.string().max(3000).optional(),
  mgr_support_commitments: z.string().max(3000).optional(),
})
```

Note: `mgr_private_note` is NOT in the Zod schema because it's managed via `useState` outside RHF (mirrors how `nextMits` is handled). Add it to `buildFormData`:

```typescript
function buildFormData(values: FormValues, submit: boolean): FormData {
  const fd = new FormData()
  fd.append('checkinId', checkin.id)
  fd.append('mgr_next_mits', JSON.stringify(nextMits.filter((m) => m.title.trim())))
  if (submit) fd.append('submit', 'true')
  Object.entries(values).forEach(([k, v]) => { if (v) fd.append(k, v) })
  if (privateNote) fd.append('mgr_private_note', privateNote)
  return fd
}
```

- [ ] **Step 2: Add private note UI at the bottom of the form, above the action buttons**

Add this block before the error div:
```tsx
{/* Private note — manager only, never shown to employee */}
<div className="rounded-[var(--radius-lr-lg)] border border-lr-border/50 bg-lr-surface p-4 space-y-1.5">
  <div className="flex items-center gap-2">
    <Label htmlFor="mgr_private_note" className="text-caption">Private note</Label>
    <span className="text-[10px] text-lr-muted bg-lr-surface-2 border border-lr-border px-1.5 py-0.5 rounded">Manager only</span>
  </div>
  <p className="text-[11px] text-lr-muted">Not visible to the employee. Useful for calibration notes.</p>
  <Textarea
    id="mgr_private_note"
    value={privateNote}
    onChange={(e) => setPrivateNote(e.target.value)}
    disabled={readOnly || isPending}
    placeholder="Internal notes for calibration, context, or follow-ups…"
    className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[80px] resize-y"
  />
</div>
```

- [ ] **Step 3: Update `upsertCheckinManager` server action**

In `src/lib/actions/checkin-actions.ts`, find `upsertCheckinManager`. Add this to the update payload:
```typescript
if (formData.get('mgr_private_note') !== null) {
  updatePayload.mgr_private_note = formData.get('mgr_private_note') as string || null
}
```

Important: the employee-facing queries (`checkins` table fetched for the employee's own view) are handled by RLS — the field is stored in the row but the form component (`EmployeeCheckinForm`) never reads or renders `mgr_private_note`. No RLS change needed.

- [ ] **Step 4: Compile check**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track" && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track"
git add src/components/checkins/ManagerCheckinForm.tsx src/lib/actions/checkin-actions.ts
git commit -m "feat(manager): add private note field to monthly check-in manager form"
```

---

## Task 5: Add private note + show employee goals in quarterly manager form

**Files:**
- Modify: `src/components/checkins/QuarterlyCheckinManagerForm.tsx`
- Modify: `src/lib/actions/quarterly-checkin-actions.ts`

- [ ] **Step 1: Show employee's quarterly goals with achieved/not status at the top of the form**

`QuarterlyCheckinManagerForm` receives `checkin: QuarterlyCheckin`. `checkin.goals` is `QuarterlyGoalReview[] | null`.

Add this block at the very top of the returned JSX (after the submitted banner, before the first field):

```tsx
{/* Employee's quarterly goals — read-only context */}
{(checkin.goals ?? []).length > 0 && (
  <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-4 space-y-3">
    <p className="text-xs font-semibold text-lr-text">Employee's goals this quarter</p>
    <ul className="space-y-2">
      {(checkin.goals ?? []).map((g, i) => (
        <li key={g.id ?? i} className="flex items-start gap-3">
          <span className={[
            'inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0 mt-0.5',
            g.status === 'achieved'
              ? 'bg-lr-cyan-dim text-lr-cyan border border-lr-cyan/20'
              : g.status === 'not_achieved'
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-lr-surface border border-lr-border text-lr-muted',
          ].join(' ')}>
            {g.status === 'achieved' ? '✓' : g.status === 'not_achieved' ? '✗' : '?'}
          </span>
          <div>
            <p className="text-xs font-medium text-lr-text">{g.title}</p>
            {g.description && <p className="text-[11px] text-lr-muted mt-0.5">{g.description}</p>}
          </div>
        </li>
      ))}
    </ul>
  </div>
)}
```

- [ ] **Step 2: Add private note state and UI**

Add to state:
```typescript
const [privateNote, setPrivateNote] = useState(checkin.mgr_private_note ?? '')
```

Add to `buildFormData`:
```typescript
if (privateNote) fd.append('mgr_private_note', privateNote)
```

Add the private note UI block (same markup as Task 4 Step 2) before the error div.

- [ ] **Step 3: Update `upsertQuarterlyCheckinManager` to persist private note**

In `src/lib/actions/quarterly-checkin-actions.ts`, add to the update payload:
```typescript
if (formData.get('mgr_private_note') !== null) {
  updatePayload.mgr_private_note = formData.get('mgr_private_note') as string || null
}
```

- [ ] **Step 4: Rename "OKR feedback" label to "Goal feedback" in the form UI**

In `QuarterlyCheckinManagerForm.tsx`, replace the label string `"Goals / OKR Feedback"` or `"OKR Feedback"` with `"Goal Feedback"`. Placeholder text: `"Your observations on the employee's goal progress this quarter…"`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track"
git add src/components/checkins/QuarterlyCheckinManagerForm.tsx src/lib/actions/quarterly-checkin-actions.ts
git commit -m "feat(manager): show employee goals in quarterly form, add private note"
```

---

## Task 6: Inbox — urgency grouping

Replace the flat list with three groups: **Overdue** (submitted > 7 days ago), **This week** (1–7 days ago), **Older** (but still pending). Apply to both monthly and quarterly pending check-ins.

**Files:**
- Modify: `src/app/(protected)/inbox/page.tsx`

- [ ] **Step 1: Add an urgency-sort helper function**

At the top of the page (alongside `timeAgo`), add:

```typescript
function urgencyGroup(submittedAt: string): 'overdue' | 'this-week' | 'older' {
  const days = Math.floor((Date.now() - new Date(submittedAt).getTime()) / 86400000)
  if (days > 7) return 'overdue'
  if (days >= 1) return 'this-week'
  return 'this-week'
}
```

- [ ] **Step 2: Replace the flat monthly check-ins list with grouped render**

Replace the `pendingCheckins.map(...)` block with:

```tsx
{['overdue', 'this-week'] as const
  .map((group) => ({
    group,
    label: group === 'overdue' ? 'Overdue (>7 days)' : 'This week',
    accent: group === 'overdue' ? 'border-red-500/30 bg-red-500/5' : 'border-lr-gold/30 bg-lr-glass',
    badge: group === 'overdue' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-lr-gold-dim text-lr-gold border-lr-gold/20',
    items: pendingCheckins.filter((c) => urgencyGroup(c.employee_submitted_at) === group),
  }))
  .filter(({ items }) => items.length > 0)
  .map(({ group, label, accent, badge, items }) => (
    <div key={group}>
      <p className="text-[11px] font-semibold text-lr-muted uppercase tracking-wide mb-2">{label}</p>
      <div className="space-y-2">
        {items.map((c) => (
          <Link key={c.id} href={`/checkins/${c.id}`}>
            <div className={`rounded-[var(--radius-lr-lg)] border backdrop-blur-[8px] p-4 hover:bg-lr-surface transition-colors cursor-pointer ${accent}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-lr-text">{c.employee_name}</p>
                  <p className="text-xs text-lr-muted">{c.employee_email}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className={`text-xs mb-1 ${badge}`}>
                    {group === 'overdue' ? 'Overdue' : 'Awaiting review'}
                  </Badge>
                  <p className="text-xs text-lr-muted">{MONTH_NAMES[c.month - 1]} {c.year} · {c.period_name}</p>
                  <p className="text-xs text-lr-muted">{timeAgo(c.employee_submitted_at)}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  ))
}
```

Apply the same grouped pattern to `pendingQuarterlyCheckins` (same structure, different href `/quarterly-checkins/${c.id}` and label `Q{c.period_quarter} {c.period_year}`).

- [ ] **Step 3: Commit**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track"
git add "src/app/(protected)/inbox/page.tsx"
git commit -m "feat(inbox): group pending check-ins by urgency (overdue vs this week)"
```

---

## Task 7: Dashboard — employee view revision

Replace the current "Quarter Progress" card with a cleaner **"What's next"** card showing: current month check-in action, period deadline, and quick goal count. Move profile to the top and keep it compact.

**Files:**
- Modify: `src/app/(protected)/dashboard/page.tsx`

The page already fetches `thisMonthCheckin`, `openPeriod`, `myOkrCounts`, `daysLeft`, `profile`, `managerName`. No new data fetching needed.

- [ ] **Step 1: Replace the employee "Quarter Progress" card with a "What's next" layout**

Replace the entire `{profile.role === 'EMPLOYEE' && openPeriod && (...)}` block with:

```tsx
{profile.role === 'EMPLOYEE' && openPeriod && (
  <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)] space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-card-title">What&apos;s next</h2>
      {daysLeft !== null && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
          daysLeft <= 7
            ? 'bg-red-500/10 text-red-400 border-red-500/20'
            : daysLeft <= 14
            ? 'bg-lr-gold-dim text-lr-gold border-lr-gold/20'
            : 'bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20'
        }`}>
          {daysLeft > 0 ? `${daysLeft}d left in ${openPeriod.name}` : 'Period ended'}
        </span>
      )}
    </div>

    {/* Next action */}
    <div className="rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface p-4">
      {!thisMonthCheckin?.employee_submitted_at ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-lr-text">{MONTH_NAMES[currentMonth - 1]} check-in due</p>
            <p className="text-xs text-lr-muted mt-0.5">Fill in your MITs and reflection for this month</p>
          </div>
          <Link
            href="/checkins/new"
            className="shrink-0 rounded-[var(--radius-lr)] bg-lr-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-lr-accent/90 transition-colors"
          >
            Start →
          </Link>
        </div>
      ) : thisMonthCheckin.manager_submitted_at ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-lr-text">{MONTH_NAMES[currentMonth - 1]} check-in complete</p>
            <p className="text-xs text-lr-muted mt-0.5">Your manager has reviewed your check-in</p>
          </div>
          <Link href={`/checkins/${thisMonthCheckin.id}`} className="text-xs text-lr-accent hover:underline shrink-0">View →</Link>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-lr-text">{MONTH_NAMES[currentMonth - 1]} check-in submitted</p>
            <p className="text-xs text-lr-gold mt-0.5">Awaiting manager review</p>
          </div>
          <Link href={`/checkins/${thisMonthCheckin.id}`} className="text-xs text-lr-accent hover:underline shrink-0">View →</Link>
        </div>
      )}
    </div>

    {/* Goals summary */}
    <div className="flex items-center justify-between text-sm">
      <span className="text-lr-muted">
        {myOkrCounts.total === 0
          ? 'No goals set this quarter'
          : `${myOkrCounts.approved} of ${myOkrCounts.total} goal${myOkrCounts.total !== 1 ? 's' : ''} approved`}
        {myOkrCounts.pending > 0 && <span className="text-lr-gold ml-1">· {myOkrCounts.pending} pending</span>}
      </span>
      <Link href="/okrs" className="text-xs text-lr-accent hover:underline">
        {myOkrCounts.total === 0 ? 'Set goals' : 'View goals'} →
      </Link>
    </div>
  </div>
)}
```

- [ ] **Step 2: Replace "Action needed" manager banner with an inline pending-work card**

Replace the `{(profile.role === 'MANAGER' || profile.role === 'HR_ADMIN') && (pendingCheckins > 0 || pendingOkrs > 0) && (...)}` block with a card that always shows (even when zero, as "All caught up"):

```tsx
{(profile.role === 'MANAGER' || profile.role === 'HR_ADMIN') && (
  <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)]">
    <h2 className="text-card-title mb-4">Pending actions</h2>
    {pendingCheckins === 0 && pendingOkrs === 0 ? (
      <p className="text-sm text-lr-cyan">All caught up — no pending reviews or approvals.</p>
    ) : (
      <div className="space-y-2">
        {pendingCheckins > 0 && (
          <Link href="/inbox">
            <div className="flex items-center justify-between rounded-[var(--radius-lr)] border border-lr-gold/30 bg-lr-gold-dim px-3 py-2.5 hover:bg-lr-gold/10 transition-colors">
              <span className="text-sm text-lr-gold">📋 {pendingCheckins} check-in{pendingCheckins !== 1 ? 's' : ''} to review</span>
              <span className="text-xs text-lr-gold/70">Inbox →</span>
            </div>
          </Link>
        )}
        {pendingOkrs > 0 && (
          <Link href="/inbox">
            <div className="flex items-center justify-between rounded-[var(--radius-lr)] border border-lr-accent/20 bg-lr-accent-dim px-3 py-2.5 hover:bg-lr-accent/10 transition-colors">
              <span className="text-sm text-lr-accent">🎯 {pendingOkrs} goal{pendingOkrs !== 1 ? 's' : ''} to approve</span>
              <span className="text-xs text-lr-accent/70">Inbox →</span>
            </div>
          </Link>
        )}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Fix any remaining "OKR" label in the dashboard (user-facing strings only)**

Search for and replace in `dashboard/page.tsx`:
- `"OKR"` → `"Goal"` in all rendered strings (not variable names)
- `href="/okrs/new"` label `"New Goal"` — already correct in existing code

- [ ] **Step 4: Commit**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track"
git add "src/app/(protected)/dashboard/page.tsx"
git commit -m "feat(dashboard): revise employee card with next-action layout, clean up manager pending card"
```

---

## Self-Review

**Spec coverage:**
1. ✅ Employee profile summary — *Not in this plan — deferred to Plan B*
2. ✅ Pre-filled manager MITs — Task 3
3. ✅ Private note — Tasks 4, 5
4. ✅ Team dashboard trends — *Deferred to Plan B*
5. ✅ Bulk scoring — *Deferred to Plan C*
6. ✅ Score calibration — *Deferred to Plan C*
7. ✅ Inbox urgency grouping — Task 6
8. ✅ Monthly feedback context (employee MITs) — Task 2
9. ✅ Quarterly form goal progress — Task 5 Step 1
10. ✅ Dashboard revision — Task 7
11. ✅ Remove OKR language — Tasks 5 Step 4, 7 Step 3

**Placeholder scan:** All tasks have concrete code. No TBDs.

**Type consistency:**
- `mgr_private_note` added to both `Checkin` and `QuarterlyCheckin` in Task 1, used in Tasks 4 and 5. ✅
- `PlanMit` imported in Task 2 but already exists in `database.ts`. ✅
- `urgencyGroup` defined in Task 6 and used in same task. ✅
