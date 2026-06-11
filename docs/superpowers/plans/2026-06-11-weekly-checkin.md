# Weekly Check-in (Beta) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a weekly 3Ps check-in (Progress / Plan / Problem) that employees write and managers read, with an aggregated monthly roll-up shown inside the monthly check-in.

**Architecture:** A dedicated `weekly_checkins` table (RLS mirroring `checkins`), a server action for upsert, a client 3Ps form, a "Weekly (Beta)" tab + routes, and a read-only roll-up section computed server-side on the monthly check-in pages. Plan tasks link to the current monthly check-in's MITs.

**Tech Stack:** Next.js 16 App Router (server components + server actions), Supabase (Postgres + RLS), TypeScript, Zod 4, Tailwind + LR design tokens, Vitest.

Spec: `docs/superpowers/specs/2026-06-11-weekly-checkin-design.md`

---

## File Structure

- Create: `src/lib/week.ts` — pure date helpers (Monday-of-week, month range). Isolated, unit-tested.
- Create: `src/lib/__tests__/week.test.ts` — tests for the helpers.
- Create: `supabase/migrations/00036_weekly_checkins.sql` — table + RLS.
- Modify: `src/lib/types/database.ts` — `WeeklyPlanTask`, `WeeklyCheckin` types.
- Create: `src/lib/actions/weekly-actions.ts` — `upsertWeeklyCheckin`.
- Create: `src/components/checkins/WeeklyCheckinForm.tsx` — the 3Ps client form.
- Create: `src/app/(protected)/weekly-checkins/new/page.tsx` — create for current week.
- Create: `src/app/(protected)/weekly-checkins/[weekId]/page.tsx` — read view + edit.
- Modify: `src/app/(protected)/checkins/page.tsx` — add "Weekly (Beta)" tab + list.
- Create: `src/components/checkins/WeeklyHighlights.tsx` — read-only monthly roll-up.
- Modify: `src/app/(protected)/checkins/new/page.tsx` and `src/app/(protected)/checkins/[checkinId]/page.tsx` — render `WeeklyHighlights`.

---

## Task 1: Week date helpers (pure functions)

**Files:**
- Create: `src/lib/week.ts`
- Test: `src/lib/__tests__/week.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/week.test.ts
import { describe, it, expect } from 'vitest'
import { mondayOf, monthRange } from '../week'

describe('mondayOf', () => {
  it('returns the same day for a Monday', () => {
    expect(mondayOf('2026-06-08')).toBe('2026-06-08') // Mon
  })
  it('returns the prior Monday for a mid-week day', () => {
    expect(mondayOf('2026-06-11')).toBe('2026-06-08') // Thu -> Mon
  })
  it('returns Monday for a Sunday', () => {
    expect(mondayOf('2026-06-14')).toBe('2026-06-08') // Sun -> prior Mon
  })
})

describe('monthRange', () => {
  it('returns [firstOfMonth, firstOfNextMonth) as ISO dates', () => {
    expect(monthRange(2026, 6)).toEqual({ start: '2026-06-01', endExclusive: '2026-07-01' })
  })
  it('rolls over the year in December', () => {
    expect(monthRange(2026, 12)).toEqual({ start: '2026-12-01', endExclusive: '2027-01-01' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/week.test.ts`
Expected: FAIL — cannot import `mondayOf`/`monthRange` from `../week`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/week.ts
// Pure date helpers for the weekly check-in. All inputs/outputs are
// 'YYYY-MM-DD' strings parsed in UTC to avoid timezone drift.

function pad(n: number): string { return String(n).padStart(2, '0') }
function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Monday (work-week start) of the week containing `dateISO` ('YYYY-MM-DD'). */
export function mondayOf(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`)
  const dow = d.getUTCDay() // 0=Sun..6=Sat
  const delta = dow === 0 ? -6 : 1 - dow // shift back to Monday
  d.setUTCDate(d.getUTCDate() + delta)
  return toISO(d)
}

/** Half-open ISO date range [start, endExclusive) covering a calendar month. */
export function monthRange(year: number, month: number): { start: string; endExclusive: string } {
  const start = `${year}-${pad(month)}-01`
  const ny = month === 12 ? year + 1 : year
  const nm = month === 12 ? 1 : month + 1
  return { start, endExclusive: `${ny}-${pad(nm)}-01` }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/week.test.ts`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/week.ts src/lib/__tests__/week.test.ts
git commit -m "feat(weekly): add week date helpers (mondayOf, monthRange)"
```

---

## Task 2: Database migration — `weekly_checkins` + RLS

**Files:**
- Create: `supabase/migrations/00036_weekly_checkins.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/00036_weekly_checkins.sql
-- Weekly Check-in (Beta): 3Ps (Progress / Plan / Problem), one row per work week.
-- Employee writes; manager reads subtree; HR reads all — mirrors `checkins` RLS.

CREATE TABLE IF NOT EXISTS weekly_checkins (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start            DATE NOT NULL,                 -- Monday of the work week
  progress              TEXT,
  plan_tasks            JSONB NOT NULL DEFAULT '[]',   -- max 2; [{title, mit_id|null, mit_label|null}]
  problems              TEXT,
  last_minute_requests  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, week_start)
);

CREATE INDEX idx_weekly_checkins_employee_week
  ON weekly_checkins (employee_id, week_start DESC);

ALTER TABLE weekly_checkins ENABLE ROW LEVEL SECURITY;

-- Employee: full control of own rows
CREATE POLICY weekly_self_rw ON weekly_checkins
  FOR ALL
  USING (employee_id = (SELECT auth.uid()))
  WITH CHECK (employee_id = (SELECT auth.uid()));

-- Manager: read reports' rows (subtree)
CREATE POLICY weekly_manager_read ON weekly_checkins
  FOR SELECT
  USING (private.is_in_my_subtree(employee_id));

-- HR Admin: read all
CREATE POLICY weekly_hr_read ON weekly_checkins
  FOR SELECT
  USING (private.is_hr_admin());
```

- [ ] **Step 2: Apply locally / to a dev branch and verify**

If using Supabase CLI locally:
Run: `npx supabase db reset` (or apply the single migration) and confirm no errors.
Otherwise apply via the Supabase MCP `apply_migration` against a **dev** project and confirm the table exists:
Run (SQL): `SELECT count(*) FROM weekly_checkins;` → Expected: `0`, no error.

- [ ] **Step 3: Verify RLS helpers exist**

Run (SQL): `SELECT proname FROM pg_proc WHERE proname IN ('is_in_my_subtree','is_hr_admin');`
Expected: both rows returned (defined in `00001_foundation.sql`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00036_weekly_checkins.sql
git commit -m "feat(weekly): add weekly_checkins table + RLS"
```

---

## Task 3: TypeScript types

**Files:**
- Modify: `src/lib/types/database.ts`

- [ ] **Step 1: Add the types**

Add near the other check-in interfaces (e.g. after `Checkin`):

```ts
export interface WeeklyPlanTask {
  title: string
  mit_id: string | null
  mit_label: string | null
}

export interface WeeklyCheckin {
  id: string
  employee_id: string
  week_start: string            // 'YYYY-MM-DD' (Monday)
  progress: string | null
  plan_tasks: WeeklyPlanTask[]
  problems: string | null
  last_minute_requests: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/database.ts
git commit -m "feat(weekly): add WeeklyCheckin / WeeklyPlanTask types"
```

---

## Task 4: Server action — `upsertWeeklyCheckin`

**Files:**
- Create: `src/lib/actions/weekly-actions.ts`

Mirrors `checkin-actions.ts`: `'use server'`, caller lookup, tolerant Zod parse (coerce null/over-long, cap plan tasks at 2), upsert by `(employee_id, week_start)`.

- [ ] **Step 1: Write the action**

```ts
// src/lib/actions/weekly-actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { mondayOf } from '@/lib/week'

type ActionResult = { success: true; id?: string } | { error: string }

// Coerce any value to a length-bounded string; never throws.
const boundedText = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' ? v : v == null ? '' : String(v)), z.string())
   .transform((s) => s.slice(0, max))

const planTaskSchema = z.object({
  title: boundedText(300),
  mit_id: z.string().nullable().catch(null),
  mit_label: z.string().nullable().catch(null),
})

export async function upsertWeeklyCheckin(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const schema = z.object({
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    progress: z.string().max(4000).optional(),
    problems: z.string().max(4000).optional(),
    last_minute_requests: z.string().max(4000).optional(),
    plan_tasks: z.string().default('[]'),
  })
  const parsed = schema.safeParse({
    weekStart: formData.get('weekStart'),
    progress: formData.get('progress') || undefined,
    problems: formData.get('problems') || undefined,
    last_minute_requests: formData.get('last_minute_requests') || undefined,
    plan_tasks: formData.get('plan_tasks') || '[]',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // Normalise week_start to the Monday, and cap plan tasks at 2 (title required).
  const weekStart = mondayOf(parsed.data.weekStart)
  let planTasks
  try {
    planTasks = z.array(planTaskSchema).parse(JSON.parse(parsed.data.plan_tasks))
      .filter((t) => t.title.trim())
      .slice(0, 2)
  } catch {
    return { error: 'Invalid plan format' }
  }

  const payload = {
    employee_id: user.id,
    week_start: weekStart,
    progress: parsed.data.progress ?? null,
    plan_tasks: planTasks,
    problems: parsed.data.problems ?? null,
    last_minute_requests: parsed.data.last_minute_requests ?? null,
    updated_at: new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('weekly_checkins')
    .upsert(payload, { onConflict: 'employee_id,week_start' })
    .select('id')
    .single()
  if (error) return { error: 'Failed to save weekly check-in: ' + error.message }

  revalidatePath('/checkins')
  revalidatePath('/weekly-checkins')
  revalidatePath('/dashboard')
  return { success: true, id: (data as { id: string }).id }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/lib/actions/weekly-actions.ts`
Expected: 0 errors, clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/weekly-actions.ts
git commit -m "feat(weekly): add upsertWeeklyCheckin server action"
```

---

## Task 5: Weekly 3Ps form component

**Files:**
- Create: `src/components/checkins/WeeklyCheckinForm.tsx`

Mirrors `EmployeeCheckinForm` (client, `useTransition`, builds FormData, calls the action). `mitOptions` is `{id,label}[]` of the current month's MITs (passed from the page).

- [ ] **Step 1: Write the component**

```tsx
// src/components/checkins/WeeklyCheckinForm.tsx
'use client'

import { useTransition, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { upsertWeeklyCheckin } from '@/lib/actions/weekly-actions'
import type { WeeklyCheckin, WeeklyPlanTask } from '@/lib/types/database'

export interface MitOption { id: string; label: string }

interface Props {
  weekStart: string
  existing: WeeklyCheckin | null
  mitOptions: MitOption[]
  readOnly?: boolean
}

const UNLINKED = '__unlinked__'

export default function WeeklyCheckinForm({ weekStart, existing, mitOptions, readOnly = false }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const [progress, setProgress] = useState(existing?.progress ?? '')
  const [problems, setProblems] = useState(existing?.problems ?? '')
  const [lastMinute, setLastMinute] = useState(existing?.last_minute_requests ?? '')
  const [plan, setPlan] = useState<WeeklyPlanTask[]>(
    existing?.plan_tasks?.length ? existing.plan_tasks : [{ title: '', mit_id: null, mit_label: null }]
  )

  function updateTask(i: number, patch: Partial<WeeklyPlanTask>) {
    setPlan(plan.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  }
  function addTask() { if (plan.length < 2) setPlan([...plan, { title: '', mit_id: null, mit_label: null }]) }
  function removeTask(i: number) { setPlan(plan.filter((_, idx) => idx !== i)) }
  function onLink(i: number, id: string) {
    if (id === UNLINKED) updateTask(i, { mit_id: null, mit_label: null })
    else updateTask(i, { mit_id: id, mit_label: mitOptions.find((o) => o.id === id)?.label ?? null })
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('weekStart', weekStart)
      fd.set('progress', progress)
      fd.set('problems', problems)
      fd.set('last_minute_requests', lastMinute)
      fd.set('plan_tasks', JSON.stringify(plan.filter((t) => t.title.trim())))
      const result = await upsertWeeklyCheckin(fd)
      if ('error' in result) { setError(result.error); return }
      setSavedAt(new Date())
      if (result.id && !pathname.includes(result.id)) {
        router.push(`/weekly-checkins/${result.id}`)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Progress */}
      <section className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-5 space-y-2">
        <Label className="text-section-label">Progress <span className="text-lr-muted">— update from last week</span></Label>
        <Textarea value={progress} onChange={(e) => setProgress(e.target.value)} disabled={readOnly || isPending}
          maxLength={4000} rows={3} placeholder="What moved forward since last week?"
          className="bg-lr-surface border-lr-border text-lr-text text-sm resize-y" />
      </section>

      {/* Plan (max 2) */}
      <section className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-5 space-y-3">
        <div>
          <Label className="text-section-label">Plan <span className="text-lr-muted">— up to 2 tasks for this week</span></Label>
        </div>
        {plan.map((t, i) => (
          <div key={i} className="rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Input value={t.title} onChange={(e) => updateTask(i, { title: e.target.value })} disabled={readOnly || isPending}
                maxLength={300} placeholder="Task for this week" className="bg-lr-surface border-lr-border text-lr-text text-sm h-9" />
              {!readOnly && plan.length > 1 && (
                <button type="button" onClick={() => removeTask(i)} className="mt-1 text-lr-muted hover:text-lr-error" aria-label="Remove task">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-caption">Monthly MIT</Label>
              {mitOptions.length > 0 ? (
                <Select value={t.mit_id ?? UNLINKED} onValueChange={(v) => onLink(i, v)} disabled={readOnly || isPending}>
                  <SelectTrigger className="bg-lr-surface border-lr-border text-lr-text text-sm h-9"><SelectValue placeholder="Link to a monthly MIT…" /></SelectTrigger>
                  <SelectContent side="bottom" position="popper" avoidCollisions={false} sideOffset={4}
                    className="bg-lr-bg border border-lr-border shadow-[var(--shadow-lr-dropdown)] min-w-[var(--radix-select-trigger-width)]">
                    {mitOptions.map((o) => (<SelectItem key={o.id} value={o.id} className="text-lr-text text-sm py-2.5 pl-3 pr-8">{o.label}</SelectItem>))}
                    <SelectItem value={UNLINKED} className="text-sm py-2.5 pl-3 pr-8"><span className="text-lr-muted italic">Not linked to a monthly MIT</span></SelectItem>
                  </SelectContent>
                </Select>
              ) : t.mit_id ? (
                <p className="text-xs text-lr-accent">MIT: {t.mit_label ?? t.mit_id}</p>
              ) : (
                <p className="text-xs text-lr-muted italic">No monthly MITs yet — set them in your monthly check-in to link here.</p>
              )}
            </div>
          </div>
        ))}
        {!readOnly && plan.length < 2 && (
          <Button type="button" variant="outline" size="sm" onClick={addTask}
            className="w-full gap-1.5 border-lr-accent text-lr-accent hover:bg-lr-accent-dim text-xs">
            <Plus className="h-3.5 w-3.5" /> Add task
          </Button>
        )}
      </section>

      {/* Problem */}
      <section className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-5 space-y-3">
        <div className="space-y-1">
          <Label className="text-section-label">Problem</Label>
          <Textarea value={problems} onChange={(e) => setProblems(e.target.value)} disabled={readOnly || isPending}
            maxLength={4000} rows={3} placeholder="What's blocking or at risk?"
            className="bg-lr-surface border-lr-border text-lr-text text-sm resize-y" />
        </div>
        <div className="space-y-1">
          <Label className="text-caption">Last-minute requests this week</Label>
          <Textarea value={lastMinute} onChange={(e) => setLastMinute(e.target.value)} disabled={readOnly || isPending}
            maxLength={4000} rows={2} placeholder="Unplanned asks that came in this week"
            className="bg-lr-surface border-lr-border text-lr-text text-sm resize-y" />
        </div>
      </section>

      {error && (<div className="rounded-[var(--radius-lr)] border border-lr-error/20 bg-lr-error-dim px-4 py-3 text-sm text-lr-error">{error}</div>)}

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={save} disabled={isPending} className="bg-lr-accent hover:bg-lr-accent/90 text-white">
            {isPending ? 'Saving…' : 'Save'}
          </Button>
          {savedAt && <span className="text-xs text-lr-success">Saved {savedAt.toLocaleTimeString()}</span>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/components/checkins/WeeklyCheckinForm.tsx`
Expected: 0 errors, clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/checkins/WeeklyCheckinForm.tsx
git commit -m "feat(weekly): add WeeklyCheckinForm (3Ps) component"
```

---

## Task 6: Weekly routes — new + detail

**Files:**
- Create: `src/app/(protected)/weekly-checkins/new/page.tsx`
- Create: `src/app/(protected)/weekly-checkins/[weekId]/page.tsx`

Both fetch the current month's MITs (from the employee's current monthly `checkins.mits`) to populate the link dropdown.

- [ ] **Step 1: Shared MIT-options helper (inline in each page)**

Both pages use this snippet to build `mitOptions` from the current monthly check-in:

```ts
// current month MITs for the link dropdown
const now = new Date()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { data: monthly } = await (supabase as any)
  .from('checkins')
  .select('mits')
  .eq('employee_id', user.id)
  .eq('month', now.getMonth() + 1)
  .eq('year', now.getFullYear())
  .maybeSingle()
const mitOptions = (((monthly?.mits ?? []) as { title: string }[]) )
  .filter((m) => m.title?.trim())
  .map((m, i) => ({ id: `${i}:${m.title}`, label: m.title }))
```

> Note: monthly MITs are stored as a JSONB array without stable ids, so we use a
> stable synthetic id `"<index>:<title>"` for the link value + `mit_label` = title.
> The roll-up (Task 8) matches coverage by `mit_label`/title.

- [ ] **Step 2: Write `new/page.tsx`**

```tsx
// src/app/(protected)/weekly-checkins/new/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WeeklyCheckinForm from '@/components/checkins/WeeklyCheckinForm'
import { mondayOf } from '@/lib/week'

export const dynamic = 'force-dynamic'

const FMT = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export default async function NewWeeklyCheckinPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date()
  const weekStart = mondayOf(`${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`)

  // If this week already exists, open it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('weekly_checkins').select('id').eq('employee_id', user.id).eq('week_start', weekStart).maybeSingle()
  if (existing) redirect(`/weekly-checkins/${existing.id}`)

  const now = new Date()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: monthly } = await (supabase as any)
    .from('checkins').select('mits').eq('employee_id', user.id).eq('month', now.getMonth() + 1).eq('year', now.getFullYear()).maybeSingle()
  const mitOptions = (((monthly?.mits ?? []) as { title: string }[]))
    .filter((m) => m.title?.trim()).map((m, i) => ({ id: `${i}:${m.title}`, label: m.title }))

  return (
    <div className="space-y-6">
      <div>
        <p className="text-kicker">Week of {FMT(weekStart)}</p>
        <h1 className="text-page-title mt-1">Weekly Check-in <span className="text-sm font-normal text-lr-muted">(Beta)</span></h1>
        <p className="text-body text-lr-muted mt-1">Progress · Plan · Problem</p>
      </div>
      <WeeklyCheckinForm weekStart={weekStart} existing={null} mitOptions={mitOptions} />
    </div>
  )
}
```

- [ ] **Step 3: Write `[weekId]/page.tsx`**

```tsx
// src/app/(protected)/weekly-checkins/[weekId]/page.tsx
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WeeklyCheckinForm from '@/components/checkins/WeeklyCheckinForm'
import type { WeeklyCheckin, Profile } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const FMT = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export default async function WeeklyCheckinDetailPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase as any).from('weekly_checkins').select('*').eq('id', weekId).maybeSingle()
  if (!row) notFound()
  const wc = row as WeeklyCheckin

  // RLS already restricts visibility; readOnly when the viewer is not the owner.
  const isOwner = wc.employee_id === user.id

  const month = Number(wc.week_start.slice(5, 7))
  const year = Number(wc.week_start.slice(0, 4))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: monthly } = await (supabase as any)
    .from('checkins').select('mits').eq('employee_id', wc.employee_id).eq('month', month).eq('year', year).maybeSingle()
  const mitOptions = (((monthly?.mits ?? []) as { title: string }[]))
    .filter((m) => m.title?.trim()).map((m, i) => ({ id: `${i}:${m.title}`, label: m.title }))

  return (
    <div className="space-y-6">
      <div>
        <p className="text-kicker">Week of {FMT(wc.week_start)}</p>
        <h1 className="text-page-title mt-1">Weekly Check-in <span className="text-sm font-normal text-lr-muted">(Beta)</span></h1>
      </div>
      <WeeklyCheckinForm weekStart={wc.week_start} existing={wc} mitOptions={mitOptions} readOnly={!isOwner} />
    </div>
  )
}
```

- [ ] **Step 4: Typecheck + lint + build**

Run: `npx tsc --noEmit && npx eslint "src/app/(protected)/weekly-checkins/**" && NEXT_TELEMETRY_DISABLED=1 npm run build`
Expected: 0 errors, clean, build compiles with `/weekly-checkins/new` and `/weekly-checkins/[weekId]` routes.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(protected)/weekly-checkins"
git commit -m "feat(weekly): add new + detail weekly check-in routes"
```

---

## Task 7: "Weekly (Beta)" tab on the check-ins list

**Files:**
- Modify: `src/app/(protected)/checkins/page.tsx`

The page already branches on `tab` (`monthly` | `quarterly`). Add `weekly`.

- [ ] **Step 1: Accept the `weekly` tab value**

Find the tab parse (currently `const tab = tabParam === 'quarterly' ? 'quarterly' : 'monthly'`) and replace with:

```ts
const tab = tabParam === 'quarterly' ? 'quarterly' : tabParam === 'weekly' ? 'weekly' : 'monthly'
```

- [ ] **Step 2: Fetch weekly rows when on the weekly tab**

In the tab-specific fetch block, add a branch:

```ts
let weeklyCheckins: { id: string; week_start: string; problems: string | null }[] = []
if (tab === 'weekly') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('weekly_checkins')
    .select('id, week_start, problems')
    .eq('employee_id', user.id)
    .order('week_start', { ascending: false })
  weeklyCheckins = data ?? []
}
```

- [ ] **Step 3: Add the tab link** (next to the Monthly / Quarterly tab links):

```tsx
<Link href="/checkins?tab=weekly" className={`${tabBase} ${tab === 'weekly' ? tabActive : tabInactive}`}>
  Weekly <span className="text-[10px] uppercase tracking-wide opacity-70">Beta</span>
</Link>
```

- [ ] **Step 4: Render the weekly list + New button**

```tsx
{tab === 'weekly' && (
  <div className="space-y-3">
    <div className="flex justify-end">
      <Link href="/weekly-checkins/new">
        <Button className="bg-lr-accent hover:bg-lr-accent/90 text-white text-sm">New weekly check-in</Button>
      </Link>
    </div>
    {weeklyCheckins.length === 0 ? (
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-12 text-center">
        <p className="text-body text-lr-muted">No weekly check-ins yet.</p>
      </div>
    ) : (
      weeklyCheckins.map((w) => (
        <Link key={w.id} href={`/weekly-checkins/${w.id}`}>
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-4 hover:bg-lr-surface transition-colors">
            <p className="text-sm font-medium text-lr-text">
              Week of {new Date(`${w.week_start}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
            </p>
            {w.problems?.trim() && <p className="text-caption text-lr-muted mt-0.5 line-clamp-1">⚠ {w.problems}</p>}
          </div>
        </Link>
      ))
    )}
  </div>
)}
```

- [ ] **Step 5: Typecheck + lint + build**

Run: `npx tsc --noEmit && npx eslint "src/app/(protected)/checkins/page.tsx" && NEXT_TELEMETRY_DISABLED=1 npm run build`
Expected: 0 errors, clean, build compiles.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(protected)/checkins/page.tsx"
git commit -m "feat(weekly): add Weekly (Beta) tab + list to check-ins page"
```

---

## Task 8: Monthly roll-up — `WeeklyHighlights`

**Files:**
- Create: `src/components/checkins/WeeklyHighlights.tsx`
- Modify: `src/app/(protected)/checkins/new/page.tsx`
- Modify: `src/app/(protected)/checkins/[checkinId]/page.tsx`

`WeeklyHighlights` is a presentational server-safe component; the pages compute the aggregate and pass it in.

- [ ] **Step 1: Write `WeeklyHighlights.tsx`**

```tsx
// src/components/checkins/WeeklyHighlights.tsx
import type { WeeklyCheckin } from '@/lib/types/database'

const FMT = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export default function WeeklyHighlights({
  weeks, monthlyMitTitles,
}: { weeks: WeeklyCheckin[]; monthlyMitTitles: string[] }) {
  if (weeks.length === 0) return null

  const issues = weeks.flatMap((w) => [
    ...(w.problems?.trim() ? [{ week: w.week_start, kind: 'Problem', text: w.problems!.trim() }] : []),
    ...(w.last_minute_requests?.trim() ? [{ week: w.week_start, kind: 'Last-minute', text: w.last_minute_requests!.trim() }] : []),
  ])
  const touched = new Set(weeks.flatMap((w) => w.plan_tasks.map((t) => t.mit_label).filter(Boolean) as string[]))

  return (
    <section className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-lr-text">Weekly highlights this month <span className="text-xs font-normal text-lr-muted">(Beta)</span></p>
        <p className="text-xs text-lr-text/50 mt-0.5">{weeks.length} weekly check-in{weeks.length !== 1 ? 's' : ''} logged</p>
      </div>

      <div className="space-y-1.5">
        <p className="text-caption text-lr-muted">Problems & last-minute requests</p>
        {issues.length === 0 ? (
          <p className="text-xs text-lr-muted italic">None logged this month.</p>
        ) : (
          <ul className="space-y-1">
            {issues.map((it, i) => (
              <li key={i} className="text-xs text-lr-text/80">
                <span className="text-lr-muted">{FMT(it.week)} · {it.kind}:</span> {it.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      {monthlyMitTitles.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-caption text-lr-muted">MIT coverage by weekly plans</p>
          <div className="flex flex-wrap gap-2">
            {monthlyMitTitles.map((title) => {
              const hit = touched.has(title)
              return (
                <span key={title} className={[
                  'rounded-full px-2.5 py-1 text-[11px] border',
                  hit ? 'border-lr-success/40 bg-lr-success/10 text-lr-success' : 'border-lr-border bg-lr-surface text-lr-muted',
                ].join(' ')}>
                  {hit ? '✓ ' : '○ '}{title}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Wire it into `checkins/[checkinId]/page.tsx`**

After `checkin` is loaded, add the aggregate fetch (uses `monthRange` for the check-in's month/year and the existing `okrOptions`/MIT data):

```ts
import { monthRange } from '@/lib/week'
import WeeklyHighlights from '@/components/checkins/WeeklyHighlights'
import type { WeeklyCheckin } from '@/lib/types/database'
// ...
const { start, endExclusive } = monthRange(checkin.year, checkin.month)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { data: weeksRaw } = await (supabase as any)
  .from('weekly_checkins')
  .select('*')
  .eq('employee_id', checkin.employee_id)
  .gte('week_start', start)
  .lt('week_start', endExclusive)
  .order('week_start', { ascending: true })
const weeks = (weeksRaw ?? []) as WeeklyCheckin[]
const monthlyMitTitles = ((checkin.mits ?? []) as { title: string }[]).map((m) => m.title).filter(Boolean)
```

Render it just below `<EmployeeCheckinForm .../>`:

```tsx
<WeeklyHighlights weeks={weeks} monthlyMitTitles={monthlyMitTitles} />
```

- [ ] **Step 3: Wire it into `checkins/new/page.tsx`** the same way

Use the resolved `month`/`year` and the (possibly empty) current month MITs:

```ts
import { monthRange } from '@/lib/week'
import WeeklyHighlights from '@/components/checkins/WeeklyHighlights'
import type { WeeklyCheckin } from '@/lib/types/database'
// ...
const { start, endExclusive } = monthRange(year, month)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { data: weeksRaw } = await (supabase as any)
  .from('weekly_checkins').select('*').eq('employee_id', user.id)
  .gte('week_start', start).lt('week_start', endExclusive).order('week_start', { ascending: true })
const weeks = (weeksRaw ?? []) as WeeklyCheckin[]
// monthlyMitTitles: this month has no committed checkin yet on /new → derive from existing weeks' labels or pass []
const monthlyMitTitles: string[] = []
```

Render `<WeeklyHighlights weeks={weeks} monthlyMitTitles={monthlyMitTitles} />` below the form.

- [ ] **Step 4: Typecheck + lint + build**

Run: `npx tsc --noEmit && npx eslint src/components/checkins/WeeklyHighlights.tsx "src/app/(protected)/checkins/new/page.tsx" "src/app/(protected)/checkins/[checkinId]/page.tsx" && NEXT_TELEMETRY_DISABLED=1 npm run build`
Expected: 0 errors, clean, build compiles.

- [ ] **Step 5: Commit**

```bash
git add src/components/checkins/WeeklyHighlights.tsx "src/app/(protected)/checkins/new/page.tsx" "src/app/(protected)/checkins/[checkinId]/page.tsx"
git commit -m "feat(weekly): monthly roll-up (WeeklyHighlights) in the monthly check-in"
```

---

## Task 9: RLS verification + full suite

**Files:** none (verification only)

- [ ] **Step 1: RLS — owner can write, manager can read, others can't (rolled-back SQL)**

Run against a **dev** Supabase project (via MCP `execute_sql`), all inside `BEGIN; … ROLLBACK;`, switching `request.jwt.claims` sub to simulate users (same technique used for the profiles RLS fix). Verify:
- employee A inserts/updates own weekly row → **succeeds**
- manager M of A `SELECT`s A's row → **succeeds**
- unrelated user U `SELECT`s A's row → **0 rows** (RLS hides it)
- user U tries to `UPDATE` A's row → **0 rows affected / blocked**

Expected: all four behaviors hold; transaction rolled back (no data left).

- [ ] **Step 2: Full suite**

Run:
```bash
npx tsc --noEmit
npx eslint .   # expect only the pre-existing repo warnings, none in new files
npx vitest run
NEXT_TELEMETRY_DISABLED=1 npm run build
```
Expected: tsc 0 errors; new files lint-clean; vitest all pass (incl. new `week.test.ts`); build compiles with the new routes.

- [ ] **Step 3: Manual smoke (logged-in dev app)**

1. Open `/checkins` → "Weekly (Beta)" tab → "New weekly check-in".
2. Fill Progress, add 2 Plan tasks, link one to a monthly MIT, fill Problem + last-minute request → Save.
3. Reopen from the list → values persist; verify the linked MIT shows.
4. Open this month's monthly check-in → "Weekly highlights this month" shows the problem/last-minute entries + MIT coverage chips.

- [ ] **Step 4: Commit (if any fixes were needed)**

```bash
git commit -am "test(weekly): RLS + suite verification fixes"
```

---

## Notes for the implementer

- Follow existing patterns: `(supabase as any)` casts, `force-dynamic` on pages, LR design tokens, server actions return `{ success } | { error }`.
- Monthly MITs have no stable ids (stored as JSONB on `checkins.mits`); the plan uses `mit_label` (the MIT title) for both linking display and roll-up coverage matching. If MITs later get stable ids, switch `mit_id` to that and match coverage by id.
- Keep weekly **save-only** — do not add a submit/draft step.
- Out of scope (do not build): weekly email reminders, manager comments, analytics.
