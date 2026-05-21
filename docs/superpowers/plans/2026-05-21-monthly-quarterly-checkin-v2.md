# Monthly & Quarterly Check-in v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the monthly and quarterly check-in forms to have a two-part Review/Plan structure with auto-carry of MITs between check-ins.

**Architecture:** New JSONB columns store enriched MIT and goal data; reusable components (`MitReviewList`, `MitPlanList`, `ValueChipSelector`, `GoalAchievementList`, `MonthlyDoneWellSummary`) replace inline form logic; server actions gain carry-forward logic that seeds the next check-in's review section on submit.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (JSONB columns + RLS), React Hook Form 7, Zod 4, Tailwind v4 + LR Design System tokens, shadcn/ui components.

---

## File Map

| Action | Path |
|--------|------|
| Create | `supabase/migrations/00011_checkin_v2.sql` |
| Modify | `src/lib/types/database.ts` |
| Create | `src/components/checkins/MitReviewList.tsx` |
| Create | `src/components/checkins/MitPlanList.tsx` |
| Create | `src/components/checkins/ValueChipSelector.tsx` |
| Create | `src/components/checkins/GoalAchievementList.tsx` |
| Create | `src/components/checkins/MonthlyDoneWellSummary.tsx` |
| Modify | `src/components/checkins/EmployeeCheckinForm.tsx` |
| Modify | `src/lib/actions/checkin-actions.ts` |
| Modify | `src/app/(protected)/quarterly-checkins/new/page.tsx` |
| Modify | `src/components/checkins/QuarterlyCheckinEmployeeForm.tsx` |
| Modify | `src/lib/actions/quarterly-checkin-actions.ts` |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/00011_checkin_v2.sql`

- [ ] **Step 1: Write the migration**

```sql
-- checkins: add employee-owned next_mits (enriched with okr link + status)
-- The old mgr_next_mits column is kept for backward compatibility with existing rows.
alter table checkins
  add column if not exists next_mits jsonb;

-- quarterly_checkins: goals review, next-quarter goals and MITs, value assessments v2
alter table quarterly_checkins
  add column if not exists goals              jsonb,
  add column if not exists next_quarter_goals jsonb,
  add column if not exists next_quarter_mits  jsonb,
  add column if not exists value_assessments  jsonb;
```

- [ ] **Step 2: Apply the migration via Supabase CLI**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track"
npx supabase db push
```

Expected: migration applied with no errors. If Supabase CLI is not linked, apply manually via the Supabase Dashboard SQL editor.

- [ ] **Step 3: Commit**

```bash
git -C "/Users/max/Lunartrack Hackaton/lunar-track" add supabase/migrations/00011_checkin_v2.sql
git -C "/Users/max/Lunartrack Hackaton/lunar-track" commit -m "feat(db): add v2 checkin columns for enriched MITs, goals, and value assessments"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/types/database.ts`

- [ ] **Step 1: Add new MIT and goal types, update `Checkin` and `QuarterlyCheckin`**

Replace the existing `Mit` interface and `Checkin`/`QuarterlyCheckin` interfaces with the following (keep all other types unchanged):

```typescript
// Replace the existing `Mit` interface
export interface ReviewMit {
  title: string
  description: string
  okr_id: string | null       // null = unrelated
  okr_label: string | null    // snapshot of OKR title at time of save
  status: 'achieved' | 'not_achieved'
}

export interface PlanMit {
  title: string
  description: string
  okr_id: string | null
  okr_label: string | null
}

// Keep the old Mit interface as a legacy alias so existing code compiles
export interface Mit {
  title: string
  description: string
}

export interface QuarterlyGoal {
  id: string          // client-generated uuid (crypto.randomUUID())
  title: string
  description: string
}

export interface QuarterlyGoalReview {
  id: string
  title: string
  description: string
  status: 'achieved' | 'not_achieved' | null
}

export interface ValueAssessment {
  value_id: string
  value_name: string
  description: string   // how they demonstrated this value
}
```

In the `Checkin` interface, add the `next_mits` field after `mits`:

```typescript
export interface Checkin {
  id: string
  employee_id: string
  period_id: string
  month: number
  year: number
  mits: ReviewMit[] | null          // updated type
  // Legacy fixed fields (kept for reading old rows)
  mit_1_title: string | null
  mit_1_description: string | null
  mit_2_title: string | null
  mit_2_description: string | null
  mit_3_title: string | null
  mit_3_description: string | null
  done_well: string | null
  do_differently: string | null
  support_requests: string | null
  ai_builder: string | null
  next_mits: PlanMit[] | null       // new: employee-owned plan for next month
  employee_submitted_at: string | null
  // Manager section (unchanged)
  mgr_mit_notes: string | null
  mgr_done_well: string | null
  mgr_do_differently: string | null
  mgr_support_commitments: string | null
  mgr_next_mits: Mit[] | null
  mgr_next_mit_1_title: string | null
  mgr_next_mit_1_description: string | null
  mgr_next_mit_2_title: string | null
  mgr_next_mit_2_description: string | null
  mgr_next_mit_3_title: string | null
  mgr_next_mit_3_description: string | null
  manager_submitted_at: string | null
  created_at: string
  updated_at: string
}
```

Replace the existing `QuarterlyCheckin` interface:

```typescript
export interface QuarterlyCheckin {
  id: string
  employee_id: string
  period_id: string
  // Employee section — new v2 fields
  goals: QuarterlyGoalReview[] | null           // goals from prev quarter's next_quarter_goals
  next_quarter_goals: QuarterlyGoal[] | null    // goals set for next quarter
  next_quarter_mits: PlanMit[] | null           // MITs for first month of next quarter
  value_assessments: ValueAssessment[] | null   // replaces value_self_assessments
  // Legacy employee fields (kept for reading old rows)
  okr_progress: QuarterlyCheckinOkrProgress[]
  value_self_assessments: ValueSelfAssessment[]
  continue_doing: string | null
  stop_doing: string | null
  start_doing: string | null
  okr_adjustments: string | null
  capability_needs: string | null
  employee_submitted_at: string | null
  // Manager section (unchanged)
  mgr_okr_feedback: string | null
  mgr_css_feedback: string | null
  mgr_adjustments_notes: string | null
  mgr_support_plan: string | null
  manager_submitted_at: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Type-check**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track" && npx tsc --noEmit 2>&1 | head -40
```

Expected: only errors in files that will be updated in later tasks (the old form components). Zero errors in `database.ts` itself.

- [ ] **Step 3: Commit**

```bash
git -C "/Users/max/Lunartrack Hackaton/lunar-track" add src/lib/types/database.ts
git -C "/Users/max/Lunartrack Hackaton/lunar-track" commit -m "feat(types): add ReviewMit, PlanMit, QuarterlyGoal, ValueAssessment types"
```

---

## Task 3: MitReviewList Component

**Files:**
- Create: `src/components/checkins/MitReviewList.tsx`

This component renders the review section MIT list — each MIT shows title, description, OKR link, and an achieved/not-achieved toggle.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import type { ReviewMit } from '@/lib/types/database'

interface MitReviewListProps {
  value: ReviewMit[]
  onChange: (mits: ReviewMit[]) => void
  disabled?: boolean
}

function emptyReviewMit(): ReviewMit {
  return { title: '', description: '', okr_id: null, okr_label: null, status: 'not_achieved' }
}

export default function MitReviewList({ value, onChange, disabled = false }: MitReviewListProps) {
  function add() {
    onChange([...value, emptyReviewMit()])
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function update(index: number, patch: Partial<ReviewMit>) {
    onChange(value.map((m, i) => i === index ? { ...m, ...patch } : m))
  }

  function toggleStatus(index: number) {
    const next = value[index].status === 'achieved' ? 'not_achieved' : 'achieved'
    update(index, { status: next })
  }

  return (
    <div className="space-y-3">
      {value.map((mit, index) => (
        <div key={index} className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <Label className="text-caption">Title</Label>
                <Input
                  value={mit.title}
                  onChange={(e) => update(index, { title: e.target.value })}
                  disabled={disabled}
                  placeholder="What was this MIT?"
                  className="bg-lr-surface border-lr-border text-lr-text text-sm h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-caption">What / description</Label>
                <Textarea
                  value={mit.description}
                  onChange={(e) => update(index, { description: e.target.value })}
                  disabled={disabled}
                  placeholder="Describe the scope or success criteria…"
                  className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[72px] resize-y"
                />
              </div>
              {(mit.okr_label || mit.okr_id) && (
                <p className="text-xs text-lr-accent">
                  OKR: {mit.okr_label ?? mit.okr_id}
                </p>
              )}
              {!mit.okr_id && (
                <p className="text-xs text-lr-muted italic">Unrelated to quarterly OKRs</p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {!disabled && value.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-lr-muted hover:text-lr-error transition-colors"
                  aria-label="Remove MIT"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => !disabled && toggleStatus(index)}
                disabled={disabled}
                className="flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                aria-label={`Mark as ${mit.status === 'achieved' ? 'not achieved' : 'achieved'}`}
              >
                {mit.status === 'achieved' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <span className="text-green-400">Achieved</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-400" />
                    <span className="text-red-400">Not achieved</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ))}

      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          className="w-full gap-1.5 border-lr-accent text-lr-accent hover:bg-lr-accent-dim text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> Add MIT
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track" && npx tsc --noEmit 2>&1 | grep MitReviewList
```

Expected: no output (no errors in the new file).

- [ ] **Step 3: Commit**

```bash
git -C "/Users/max/Lunartrack Hackaton/lunar-track" add src/components/checkins/MitReviewList.tsx
git -C "/Users/max/Lunartrack Hackaton/lunar-track" commit -m "feat(checkins): add MitReviewList component"
```

---

## Task 4: MitPlanList Component

**Files:**
- Create: `src/components/checkins/MitPlanList.tsx`

Renders the plan section MIT list — each MIT has title, description, and a dropdown linking to an OKR or goal (or "unrelated").

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import type { PlanMit } from '@/lib/types/database'

export interface LinkOption {
  id: string
  label: string
}

interface MitPlanListProps {
  value: PlanMit[]
  onChange: (mits: PlanMit[]) => void
  linkOptions: LinkOption[]          // active OKRs or quarterly goals
  linkLabel?: string                 // label for the dropdown, default "Quarterly OKR"
  noLinkLabel?: string               // label for the "unrelated" option
  disabled?: boolean
}

const UNRELATED = '__unrelated__'

function emptyPlanMit(): PlanMit {
  return { title: '', description: '', okr_id: null, okr_label: null }
}

export default function MitPlanList({
  value,
  onChange,
  linkOptions,
  linkLabel = 'Quarterly OKR',
  noLinkLabel = 'Unrelated to quarterly OKRs',
  disabled = false,
}: MitPlanListProps) {
  function add() {
    onChange([...value, emptyPlanMit()])
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function update(index: number, patch: Partial<PlanMit>) {
    onChange(value.map((m, i) => i === index ? { ...m, ...patch } : m))
  }

  function handleLinkChange(index: number, selectedId: string) {
    if (selectedId === UNRELATED) {
      update(index, { okr_id: null, okr_label: null })
    } else {
      const option = linkOptions.find((o) => o.id === selectedId)
      update(index, { okr_id: selectedId, okr_label: option?.label ?? null })
    }
  }

  return (
    <div className="space-y-3">
      {value.map((mit, index) => (
        <div key={index} className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <Label className="text-caption">Title</Label>
                <Input
                  value={mit.title}
                  onChange={(e) => update(index, { title: e.target.value })}
                  disabled={disabled}
                  placeholder="What is this MIT?"
                  className="bg-lr-surface border-lr-border text-lr-text text-sm h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-caption">What / description</Label>
                <Textarea
                  value={mit.description}
                  onChange={(e) => update(index, { description: e.target.value })}
                  disabled={disabled}
                  placeholder="Describe the scope or success criteria…"
                  className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[72px] resize-y"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-caption">{linkLabel}</Label>
                <Select
                  value={mit.okr_id ?? UNRELATED}
                  onValueChange={(v) => handleLinkChange(index, v)}
                  disabled={disabled}
                >
                  <SelectTrigger className="bg-lr-surface border-lr-border text-lr-text text-sm h-9">
                    <SelectValue placeholder={`Link to ${linkLabel}…`} />
                  </SelectTrigger>
                  <SelectContent>
                    {linkOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                    <SelectItem value={UNRELATED}>
                      <span className="text-lr-muted italic">{noLinkLabel}</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!disabled && value.length > 1 && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="mt-1 text-lr-muted hover:text-lr-error transition-colors flex-shrink-0"
                aria-label="Remove MIT"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}

      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          className="w-full gap-1.5 border-lr-accent text-lr-accent hover:bg-lr-accent-dim text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> Add MIT
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track" && npx tsc --noEmit 2>&1 | grep MitPlanList
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git -C "/Users/max/Lunartrack Hackaton/lunar-track" add src/components/checkins/MitPlanList.tsx
git -C "/Users/max/Lunartrack Hackaton/lunar-track" commit -m "feat(checkins): add MitPlanList component"
```

---

## Task 5: ValueChipSelector Component

**Files:**
- Create: `src/components/checkins/ValueChipSelector.tsx`

Multi-select chips for company values; selected values expand to show a text area for describing how the value was demonstrated.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { CompanyValue, ValueAssessment } from '@/lib/types/database'

interface ValueChipSelectorProps {
  companyValues: CompanyValue[]
  value: ValueAssessment[]
  onChange: (assessments: ValueAssessment[]) => void
  disabled?: boolean
}

export default function ValueChipSelector({
  companyValues,
  value,
  onChange,
  disabled = false,
}: ValueChipSelectorProps) {
  const selectedIds = new Set(value.map((a) => a.value_id))

  function toggle(cv: CompanyValue) {
    if (disabled) return
    if (selectedIds.has(cv.id)) {
      onChange(value.filter((a) => a.value_id !== cv.id))
    } else {
      onChange([...value, { value_id: cv.id, value_name: cv.name, description: '' }])
    }
  }

  function updateDescription(value_id: string, description: string) {
    onChange(value.map((a) => a.value_id === value_id ? { ...a, description } : a))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {companyValues.map((cv) => {
          const selected = selectedIds.has(cv.id)
          return (
            <button
              key={cv.id}
              type="button"
              onClick={() => toggle(cv)}
              disabled={disabled}
              className={[
                'rounded-full px-4 py-1.5 text-sm font-medium border transition-colors',
                selected
                  ? 'bg-lr-accent/20 border-lr-accent text-lr-accent'
                  : 'bg-lr-surface border-lr-border text-lr-muted hover:border-lr-accent/50',
                disabled ? 'opacity-50 cursor-default' : 'cursor-pointer',
              ].join(' ')}
            >
              {selected && <span className="mr-1">✓</span>}
              {cv.name}
            </button>
          )
        })}
      </div>

      {value.length > 0 && (
        <div className="space-y-3">
          {value.map((assessment) => (
            <div
              key={assessment.value_id}
              className="rounded-[var(--radius-lr-lg)] border-l-2 border-lr-accent bg-lr-surface p-4 space-y-2"
            >
              <Label className="text-caption text-lr-accent">{assessment.value_name}</Label>
              <Textarea
                value={assessment.description}
                onChange={(e) => updateDescription(assessment.value_id, e.target.value)}
                disabled={disabled}
                placeholder={`How did you demonstrate ${assessment.value_name} this quarter?`}
                className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[80px] resize-y"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track" && npx tsc --noEmit 2>&1 | grep ValueChipSelector
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git -C "/Users/max/Lunartrack Hackaton/lunar-track" add src/components/checkins/ValueChipSelector.tsx
git -C "/Users/max/Lunartrack Hackaton/lunar-track" commit -m "feat(checkins): add ValueChipSelector component"
```

---

## Task 6: GoalAchievementList Component

**Files:**
- Create: `src/components/checkins/GoalAchievementList.tsx`

Read/write list of quarterly goals with ✓/✗ toggle. Used in quarterly review section.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import type { QuarterlyGoalReview } from '@/lib/types/database'

interface GoalAchievementListProps {
  value: QuarterlyGoalReview[]
  onChange: (goals: QuarterlyGoalReview[]) => void
  disabled?: boolean
}

export default function GoalAchievementList({ value, onChange, disabled = false }: GoalAchievementListProps) {
  function toggleStatus(index: number) {
    if (disabled) return
    const current = value[index].status
    const next = current === 'achieved' ? 'not_achieved' : 'achieved'
    onChange(value.map((g, i) => i === index ? { ...g, status: next } : g))
  }

  if (value.length === 0) {
    return (
      <p className="text-sm text-lr-muted italic">
        No goals were set for this quarter.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {value.map((goal, index) => (
        <div
          key={goal.id}
          className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 flex items-start justify-between gap-4"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-lr-text">{goal.title}</p>
            {goal.description && (
              <p className="text-xs text-lr-muted mt-1">{goal.description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => toggleStatus(index)}
            disabled={disabled}
            className="flex items-center gap-1.5 text-xs font-medium flex-shrink-0 transition-colors disabled:opacity-50"
            aria-label={`Mark as ${goal.status === 'achieved' ? 'not achieved' : 'achieved'}`}
          >
            {goal.status === 'achieved' ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-green-400">Achieved</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-red-400">Not achieved</span>
              </>
            )}
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track" && npx tsc --noEmit 2>&1 | grep GoalAchievementList
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git -C "/Users/max/Lunartrack Hackaton/lunar-track" add src/components/checkins/GoalAchievementList.tsx
git -C "/Users/max/Lunartrack Hackaton/lunar-track" commit -m "feat(checkins): add GoalAchievementList component"
```

---

## Task 7: MonthlyDoneWellSummary Component

**Files:**
- Create: `src/components/checkins/MonthlyDoneWellSummary.tsx`

Read-only panel showing `done_well` and `do_differently` from up to 3 monthly check-ins. Data is fetched server-side and passed as props.

- [ ] **Step 1: Create the component**

```tsx
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export interface MonthlyReflection {
  month: number   // 1–12
  year: number
  done_well: string | null
  do_differently: string | null
}

interface MonthlyDoneWellSummaryProps {
  reflections: MonthlyReflection[]
}

export default function MonthlyDoneWellSummary({ reflections }: MonthlyDoneWellSummaryProps) {
  const filtered = reflections.filter((r) => r.done_well || r.do_differently)

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-lr-muted italic">
        No monthly reflections found for this quarter yet.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-green-400">Done well</p>
        <div className="space-y-2">
          {filtered.map((r, i) =>
            r.done_well ? (
              <div key={i} className="border-l-2 border-lr-accent/40 pl-3">
                <p className="text-[10px] text-lr-muted mb-0.5">
                  {MONTH_NAMES[r.month - 1]} {r.year}
                </p>
                <p className="text-xs text-lr-text">{r.done_well}</p>
              </div>
            ) : null
          )}
        </div>
      </div>

      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Done differently</p>
        <div className="space-y-2">
          {filtered.map((r, i) =>
            r.do_differently ? (
              <div key={i} className="border-l-2 border-red-400/40 pl-3">
                <p className="text-[10px] text-lr-muted mb-0.5">
                  {MONTH_NAMES[r.month - 1]} {r.year}
                </p>
                <p className="text-xs text-lr-text">{r.do_differently}</p>
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track" && npx tsc --noEmit 2>&1 | grep MonthlyDoneWellSummary
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git -C "/Users/max/Lunartrack Hackaton/lunar-track" add src/components/checkins/MonthlyDoneWellSummary.tsx
git -C "/Users/max/Lunartrack Hackaton/lunar-track" commit -m "feat(checkins): add MonthlyDoneWellSummary component"
```

---

## Task 8: Rewrite EmployeeCheckinForm

**Files:**
- Modify: `src/components/checkins/EmployeeCheckinForm.tsx`

Two-section layout: **Review** (MitReviewList + done_well/do_differently) then **Next Month** (MitPlanList). Receives active OKRs as props for the plan dropdown.

- [ ] **Step 1: Replace the entire file**

```tsx
'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import MitReviewList from '@/components/checkins/MitReviewList'
import MitPlanList, { type LinkOption } from '@/components/checkins/MitPlanList'
import { upsertCheckinEmployee } from '@/lib/actions/checkin-actions'
import type { Checkin, ReviewMit, PlanMit } from '@/lib/types/database'

interface EmployeeCheckinFormProps {
  periodId: string
  month: number
  year: number
  checkin: Checkin | null
  okrOptions: LinkOption[]   // active approved OKRs for this employee/period
  readOnly?: boolean
}

function initReviewMits(checkin: Checkin | null): ReviewMit[] {
  if (!checkin) return [{ title: '', description: '', okr_id: null, okr_label: null, status: 'not_achieved' }]
  if (checkin.mits && checkin.mits.length > 0) {
    // mits may be legacy Mit[] (no status field) — coerce safely
    return checkin.mits.map((m) => ({
      title: m.title,
      description: m.description,
      okr_id: (m as ReviewMit).okr_id ?? null,
      okr_label: (m as ReviewMit).okr_label ?? null,
      status: (m as ReviewMit).status ?? 'not_achieved',
    }))
  }
  // Coerce from legacy fixed columns
  const legacy: ReviewMit[] = []
  if (checkin.mit_1_title) legacy.push({ title: checkin.mit_1_title, description: checkin.mit_1_description ?? '', okr_id: null, okr_label: null, status: 'not_achieved' })
  if (checkin.mit_2_title) legacy.push({ title: checkin.mit_2_title, description: checkin.mit_2_description ?? '', okr_id: null, okr_label: null, status: 'not_achieved' })
  if (checkin.mit_3_title) legacy.push({ title: checkin.mit_3_title, description: checkin.mit_3_description ?? '', okr_id: null, okr_label: null, status: 'not_achieved' })
  return legacy.length > 0 ? legacy : [{ title: '', description: '', okr_id: null, okr_label: null, status: 'not_achieved' }]
}

function initPlanMits(checkin: Checkin | null): PlanMit[] {
  if (!checkin?.next_mits || checkin.next_mits.length === 0) {
    return [{ title: '', description: '', okr_id: null, okr_label: null }]
  }
  return checkin.next_mits
}

export default function EmployeeCheckinForm({
  periodId,
  month,
  year,
  checkin,
  okrOptions,
  readOnly = false,
}: EmployeeCheckinFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [reviewMits, setReviewMits] = useState<ReviewMit[]>(() => initReviewMits(checkin))
  const [nextMits, setNextMits] = useState<PlanMit[]>(() => initPlanMits(checkin))
  const [doneWell, setDoneWell] = useState(checkin?.done_well ?? '')
  const [doDifferently, setDoDifferently] = useState(checkin?.do_differently ?? '')

  function buildFormData(submit: boolean): FormData {
    const fd = new FormData()
    fd.append('periodId', periodId)
    fd.append('month', String(month))
    fd.append('year', String(year))
    fd.append('review_mits', JSON.stringify(reviewMits.filter((m) => m.title.trim())))
    fd.append('next_mits', JSON.stringify(nextMits.filter((m) => m.title.trim())))
    fd.append('done_well', doneWell)
    fd.append('do_differently', doDifferently)
    if (submit) fd.append('submit', 'true')
    return fd
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await upsertCheckinEmployee(buildFormData(false))
      if ('error' in result) {
        setError(result.error)
      } else {
        setSavedAt(new Date())
        if (result.id) router.replace(`/checkins/${result.id}`)
      }
    })
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await upsertCheckinEmployee(buildFormData(true))
      if ('error' in result) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      {readOnly && (
        <div className="rounded-[var(--radius-lr)] border border-lr-accent/20 bg-lr-accent-dim px-4 py-3 text-sm text-lr-accent">
          You submitted this check-in. Editing is locked.
        </div>
      )}

      {/* ── REVIEW SECTION ── */}
      <section className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-5 space-y-5">
        <h3 className="text-card-title text-lr-accent">Review</h3>

        <div className="space-y-2">
          <p className="text-section-label">MITs — Last Month</p>
          <MitReviewList value={reviewMits} onChange={setReviewMits} disabled={readOnly || isPending} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="done_well" className="text-caption">Done well</Label>
            <Textarea
              id="done_well"
              value={doneWell}
              onChange={(e) => setDoneWell(e.target.value)}
              disabled={readOnly || isPending}
              placeholder="What went well this month?"
              className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[100px] resize-y"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="do_differently" className="text-caption">Done differently</Label>
            <Textarea
              id="do_differently"
              value={doDifferently}
              onChange={(e) => setDoDifferently(e.target.value)}
              disabled={readOnly || isPending}
              placeholder="What would you change?"
              className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[100px] resize-y"
            />
          </div>
        </div>
      </section>

      {/* ── NEXT MONTH SECTION ── */}
      <section className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-5 space-y-4">
        <div>
          <h3 className="text-card-title text-lr-accent">Next Month</h3>
          <p className="text-xs text-lr-muted mt-1">
            These MITs will carry over to the review section of next month&apos;s check-in.
          </p>
        </div>

        <MitPlanList
          value={nextMits}
          onChange={setNextMits}
          linkOptions={okrOptions}
          linkLabel="Quarterly OKR"
          noLinkLabel="Unrelated to quarterly OKRs"
          disabled={readOnly || isPending}
        />
      </section>

      {error && (
        <div className="rounded-[var(--radius-lr)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={save}
            disabled={isPending}
            variant="outline"
            className="border-lr-border text-lr-text hover:bg-lr-surface"
          >
            {isPending ? 'Saving…' : 'Save Draft'}
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="bg-lr-accent hover:bg-lr-accent/90 text-white"
          >
            {isPending ? 'Submitting…' : 'Submit Check-in'}
          </Button>
          {savedAt && (
            <span className="text-xs text-lr-muted">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update the monthly check-in new/edit page to pass `okrOptions`**

Open `src/app/(protected)/checkins/new/page.tsx`. Find where `EmployeeCheckinForm` is rendered and add the `okrOptions` prop. Add a query before the component render to fetch approved OKRs for this employee/period:

```tsx
// Add this query in the server component, after fetching the checkin:
const { data: okrsRaw } = await (supabase as any)
  .from('okrs')
  .select('id, title')
  .eq('employee_id', profile.id)
  .eq('period_id', period.id)
  .eq('status', 'APPROVED')

const okrOptions = (okrsRaw ?? []).map((o: { id: string; title: string }) => ({
  id: o.id,
  label: o.title,
}))

// Then pass to the form:
// <EmployeeCheckinForm ... okrOptions={okrOptions} />
```

- [ ] **Step 3: Type-check**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track" && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors only in `checkin-actions.ts` (next task). No errors in the form file.

- [ ] **Step 4: Commit**

```bash
git -C "/Users/max/Lunartrack Hackaton/lunar-track" add src/components/checkins/EmployeeCheckinForm.tsx src/app/(protected)/checkins/new/page.tsx
git -C "/Users/max/Lunartrack Hackaton/lunar-track" commit -m "feat(checkins): rewrite EmployeeCheckinForm with two-section layout"
```

---

## Task 9: Update Monthly Check-in Server Action + Carry Logic

**Files:**
- Modify: `src/lib/actions/checkin-actions.ts`

Update `upsertCheckinEmployee` to handle `review_mits` and `next_mits`, and on submit carry `next_mits` to the following month's check-in.

- [ ] **Step 1: Replace `upsertCheckinEmployee` (keep `upsertCheckinManager` unchanged)**

Replace everything from line 1 through the end of `upsertCheckinEmployee` (up to but not including `upsertCheckinManager`):

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Profile, Checkin, ReviewMit, PlanMit } from '@/lib/types/database'
import {
  notifyManagerCheckinSubmitted,
  notifyEmployeeCheckinReviewed,
} from '@/lib/notifications'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

type ActionResult = { success: true; id?: string } | { error: string }

async function getCallerProfile(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single()
  return data as Profile | null
}

const reviewMitSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(500).default(''),
  okr_id: z.string().nullable().default(null),
  okr_label: z.string().nullable().default(null),
  status: z.enum(['achieved', 'not_achieved']).default('not_achieved'),
})

const planMitSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(500).default(''),
  okr_id: z.string().nullable().default(null),
  okr_label: z.string().nullable().default(null),
})

export async function upsertCheckinEmployee(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  const schema = z.object({
    periodId: z.string().uuid(),
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2020).max(2099),
    review_mits: z.string().default('[]'),
    next_mits: z.string().default('[]'),
    done_well: z.string().max(3000).optional(),
    do_differently: z.string().max(3000).optional(),
    submit: z.string().optional(),
  })

  const parsed = schema.safeParse({
    periodId: formData.get('periodId'),
    month: formData.get('month'),
    year: formData.get('year'),
    review_mits: formData.get('review_mits') || '[]',
    next_mits: formData.get('next_mits') || '[]',
    done_well: formData.get('done_well') || undefined,
    do_differently: formData.get('do_differently') || undefined,
    submit: formData.get('submit') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  let reviewMits: ReviewMit[]
  let nextMits: PlanMit[]
  try {
    reviewMits = z.array(reviewMitSchema).parse(JSON.parse(parsed.data.review_mits))
    nextMits = z.array(planMitSchema).parse(JSON.parse(parsed.data.next_mits))
  } catch {
    return { error: 'Invalid MITs format' }
  }

  const isSubmit = parsed.data.submit === 'true'
  if (isSubmit && !reviewMits.some((m) => m.title.trim())) {
    return { error: 'At least one MIT is required before submitting' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('checkins')
    .select('id, employee_submitted_at')
    .eq('employee_id', caller.id)
    .eq('period_id', parsed.data.periodId)
    .eq('month', parsed.data.month)
    .eq('year', parsed.data.year)
    .maybeSingle()

  if (existing?.employee_submitted_at) {
    return { error: 'Check-in already submitted. Editing is not allowed.' }
  }

  const payload: Record<string, unknown> = {
    employee_id: caller.id,
    period_id: parsed.data.periodId,
    month: parsed.data.month,
    year: parsed.data.year,
    mits: reviewMits,
    next_mits: nextMits,
    done_well: parsed.data.done_well ?? null,
    do_differently: parsed.data.do_differently ?? null,
    updated_at: new Date().toISOString(),
  }
  if (isSubmit) payload.employee_submitted_at = new Date().toISOString()

  let checkinId: string
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('checkins').update(payload).eq('id', existing.id)
    checkinId = existing.id
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newCheckin, error: insertError } = await (supabase as any)
      .from('checkins').insert(payload).select('id').single()
    if (insertError) {
      if (insertError.code === '23505') return { error: 'A check-in for this month already exists' }
      return { error: 'Failed to create check-in: ' + insertError.message }
    }
    checkinId = (newCheckin as { id: string }).id
  }

  if (isSubmit && nextMits.some((m) => m.title.trim())) {
    await carryMitsToNextMonth(supabase, {
      employeeId: caller.id,
      periodId: parsed.data.periodId,
      currentMonth: parsed.data.month,
      currentYear: parsed.data.year,
      nextMits,
    })
  }

  revalidatePath('/checkins')
  revalidatePath(`/checkins/${checkinId}`)
  revalidatePath('/dashboard')

  if (isSubmit && caller.manager_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mgr } = await (supabase as any)
      .from('profiles').select('email, full_name').eq('id', caller.manager_id).single()
    if (mgr) {
      const { data: { user } } = await supabase.auth.getUser()
      void notifyManagerCheckinSubmitted({
        managerEmail: mgr.email,
        managerName: mgr.full_name,
        employeeName: caller.full_name ?? (user?.email ?? 'Employee'),
        month: MONTH_NAMES[parsed.data.month - 1],
        year: parsed.data.year,
        checkinId,
      })
    }
  }

  return { success: true, id: checkinId }
}

async function carryMitsToNextMonth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: {
    employeeId: string
    periodId: string
    currentMonth: number
    currentYear: number
    nextMits: PlanMit[]
  }
) {
  const { employeeId, periodId, currentMonth, currentYear, nextMits } = opts
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear

  const carriedMits: ReviewMit[] = nextMits.map((m) => ({
    title: m.title,
    description: m.description,
    okr_id: m.okr_id,
    okr_label: m.okr_label,
    status: 'not_achieved' as const,
  }))

  const { data: nextCheckin } = await supabase
    .from('checkins')
    .select('id, employee_submitted_at')
    .eq('employee_id', employeeId)
    .eq('period_id', periodId)
    .eq('month', nextMonth)
    .eq('year', nextYear)
    .maybeSingle()

  if (nextCheckin) {
    // Only overwrite if not yet submitted
    if (!nextCheckin.employee_submitted_at) {
      await supabase.from('checkins').update({ mits: carriedMits, updated_at: new Date().toISOString() }).eq('id', nextCheckin.id)
    }
  } else {
    await supabase.from('checkins').insert({
      employee_id: employeeId,
      period_id: periodId,
      month: nextMonth,
      year: nextYear,
      mits: carriedMits,
    })
  }
}
```

- [ ] **Step 2: Type-check**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track" && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors in `checkin-actions.ts`.

- [ ] **Step 3: Commit**

```bash
git -C "/Users/max/Lunartrack Hackaton/lunar-track" add src/lib/actions/checkin-actions.ts
git -C "/Users/max/Lunartrack Hackaton/lunar-track" commit -m "feat(checkins): update monthly action with v2 fields and next-month carry logic"
```

---

## Task 10: Update Quarterly Check-in New Page

**Files:**
- Modify: `src/app/(protected)/quarterly-checkins/new/page.tsx`

The server component needs to: (1) fetch the 3 monthly check-ins for this quarter to pass to `MonthlyDoneWellSummary`, (2) fetch the previous quarterly check-in to extract `next_quarter_goals` for the review section.

- [ ] **Step 1: Read the existing page file**

Open `src/app/(protected)/quarterly-checkins/new/page.tsx` and identify where the existing OKR fetch and `QuarterlyCheckinEmployeeForm` render happen.

- [ ] **Step 2: Add the two new server-side queries before the return statement**

```typescript
// Fetch 3 monthly check-ins for this quarter (months 1–3 within the period)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { data: monthlyCheckins } = await (supabase as any)
  .from('checkins')
  .select('month, year, done_well, do_differently')
  .eq('employee_id', profile.id)
  .eq('period_id', period.id)
  .order('month', { ascending: true })
  .limit(3)

const monthlyReflections: import('@/components/checkins/MonthlyDoneWellSummary').MonthlyReflection[] =
  (monthlyCheckins ?? []).map((c: { month: number; year: number; done_well: string | null; do_differently: string | null }) => ({
    month: c.month,
    year: c.year,
    done_well: c.done_well,
    do_differently: c.do_differently,
  }))

// Fetch previous quarter's check-in to get goals for review
// Find the period immediately before this one by year/quarter
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { data: prevPeriodRaw } = await (supabase as any)
  .from('performance_periods')
  .select('id')
  .eq('year', period.quarter === 1 ? period.year - 1 : period.year)
  .eq('quarter', period.quarter === 1 ? 4 : period.quarter - 1)
  .maybeSingle()

let prevQuarterGoals: import('@/lib/types/database').QuarterlyGoalReview[] = []
if (prevPeriodRaw?.id) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prevCheckin } = await (supabase as any)
    .from('quarterly_checkins')
    .select('next_quarter_goals')
    .eq('employee_id', profile.id)
    .eq('period_id', prevPeriodRaw.id)
    .maybeSingle()
  if (prevCheckin?.next_quarter_goals) {
    prevQuarterGoals = (prevCheckin.next_quarter_goals as import('@/lib/types/database').QuarterlyGoal[]).map((g) => ({
      ...g,
      status: null,
    }))
  }
}
```

- [ ] **Step 3: Pass the new props to `QuarterlyCheckinEmployeeForm`**

Update the component render call to include the new props:
```tsx
<QuarterlyCheckinEmployeeForm
  // ...existing props...
  monthlyReflections={monthlyReflections}
  initialGoals={prevQuarterGoals}
/>
```

- [ ] **Step 4: Type-check**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track" && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors in `QuarterlyCheckinEmployeeForm.tsx` only (next task). No errors in the page file itself.

- [ ] **Step 5: Commit**

```bash
git -C "/Users/max/Lunartrack Hackaton/lunar-track" add "src/app/(protected)/quarterly-checkins/new/page.tsx"
git -C "/Users/max/Lunartrack Hackaton/lunar-track" commit -m "feat(quarterly): fetch monthly reflections and prev-quarter goals in new page"
```

---

## Task 11: Rewrite QuarterlyCheckinEmployeeForm

**Files:**
- Modify: `src/components/checkins/QuarterlyCheckinEmployeeForm.tsx`

Two sections: Review (GoalAchievementList + MonthlyDoneWellSummary + ValueChipSelector) and Next Quarter (goal list + MitPlanList).

- [ ] **Step 1: Replace the entire file**

```tsx
'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-react'
import GoalAchievementList from '@/components/checkins/GoalAchievementList'
import MonthlyDoneWellSummary, { type MonthlyReflection } from '@/components/checkins/MonthlyDoneWellSummary'
import ValueChipSelector from '@/components/checkins/ValueChipSelector'
import MitPlanList, { type LinkOption } from '@/components/checkins/MitPlanList'
import { upsertQuarterlyCheckinEmployee } from '@/lib/actions/quarterly-checkin-actions'
import type {
  QuarterlyCheckin,
  CompanyValue,
  QuarterlyGoal,
  QuarterlyGoalReview,
  ValueAssessment,
  PlanMit,
} from '@/lib/types/database'

interface QuarterlyCheckinEmployeeFormProps {
  periodId: string
  checkin: QuarterlyCheckin | null
  companyValues: CompanyValue[]
  monthlyReflections: MonthlyReflection[]
  initialGoals: QuarterlyGoalReview[]   // goals from prev quarter's next_quarter_goals
  readOnly?: boolean
}

function initGoals(checkin: QuarterlyCheckin | null, initialGoals: QuarterlyGoalReview[]): QuarterlyGoalReview[] {
  if (checkin?.goals && checkin.goals.length > 0) return checkin.goals
  return initialGoals
}

function initNextGoals(checkin: QuarterlyCheckin | null): QuarterlyGoal[] {
  if (checkin?.next_quarter_goals && checkin.next_quarter_goals.length > 0) return checkin.next_quarter_goals
  return [{ id: crypto.randomUUID(), title: '', description: '' }]
}

function initNextMits(checkin: QuarterlyCheckin | null): PlanMit[] {
  if (checkin?.next_quarter_mits && checkin.next_quarter_mits.length > 0) return checkin.next_quarter_mits
  return [{ title: '', description: '', okr_id: null, okr_label: null }]
}

function initValueAssessments(checkin: QuarterlyCheckin | null): ValueAssessment[] {
  if (checkin?.value_assessments && checkin.value_assessments.length > 0) return checkin.value_assessments
  return []
}

export default function QuarterlyCheckinEmployeeForm({
  periodId,
  checkin,
  companyValues,
  monthlyReflections,
  initialGoals,
  readOnly = false,
}: QuarterlyCheckinEmployeeFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  // Review section state
  const [goals, setGoals] = useState<QuarterlyGoalReview[]>(() => initGoals(checkin, initialGoals))
  const [valueAssessments, setValueAssessments] = useState<ValueAssessment[]>(() => initValueAssessments(checkin))

  // Next quarter section state
  const [nextGoals, setNextGoals] = useState<QuarterlyGoal[]>(() => initNextGoals(checkin))
  const [nextMits, setNextMits] = useState<PlanMit[]>(() => initNextMits(checkin))

  // Derive goal link options for the MitPlanList from current nextGoals state
  const goalLinkOptions: LinkOption[] = nextGoals
    .filter((g) => g.title.trim())
    .map((g) => ({ id: g.id, label: g.title }))

  function addNextGoal() {
    setNextGoals((prev) => [...prev, { id: crypto.randomUUID(), title: '', description: '' }])
  }

  function removeNextGoal(index: number) {
    const removed = nextGoals[index]
    setNextGoals((prev) => prev.filter((_, i) => i !== index))
    // Clear any MIT links pointing to the removed goal
    setNextMits((prev) => prev.map((m) =>
      m.okr_id === removed.id ? { ...m, okr_id: null, okr_label: null } : m
    ))
  }

  function updateNextGoal(index: number, patch: Partial<QuarterlyGoal>) {
    setNextGoals((prev) => prev.map((g, i) => {
      if (i !== index) return g
      const updated = { ...g, ...patch }
      // Keep MIT label snapshots in sync if title changed
      if (patch.title !== undefined) {
        setNextMits((mits) => mits.map((m) =>
          m.okr_id === g.id ? { ...m, okr_label: patch.title! } : m
        ))
      }
      return updated
    }))
  }

  function buildFormData(submit: boolean): FormData {
    const fd = new FormData()
    fd.append('periodId', periodId)
    fd.append('goals', JSON.stringify(goals))
    fd.append('next_quarter_goals', JSON.stringify(nextGoals.filter((g) => g.title.trim())))
    fd.append('next_quarter_mits', JSON.stringify(nextMits.filter((m) => m.title.trim())))
    fd.append('value_assessments', JSON.stringify(valueAssessments))
    if (submit) fd.append('submit', 'true')
    return fd
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await upsertQuarterlyCheckinEmployee(buildFormData(false))
      if ('error' in result) {
        setError(result.error)
      } else {
        setSavedAt(new Date())
        if (result.id) router.replace(`/quarterly-checkins/${result.id}`)
      }
    })
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await upsertQuarterlyCheckinEmployee(buildFormData(true))
      if ('error' in result) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      {readOnly && (
        <div className="rounded-[var(--radius-lr)] border border-lr-accent/20 bg-lr-accent-dim px-4 py-3 text-sm text-lr-accent">
          You submitted this check-in. Editing is locked.
        </div>
      )}

      {/* ── REVIEW SECTION ── */}
      <section className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-5 space-y-6">
        <h3 className="text-card-title text-lr-accent">Review</h3>

        <div className="space-y-2">
          <p className="text-section-label">Goal Achievements</p>
          <GoalAchievementList value={goals} onChange={setGoals} disabled={readOnly || isPending} />
        </div>

        <div className="space-y-2">
          <p className="text-section-label">Done Well / Done Differently</p>
          <p className="text-xs text-lr-muted">Auto-pulled from your last 3 monthly check-ins</p>
          <MonthlyDoneWellSummary reflections={monthlyReflections} />
        </div>

        <div className="space-y-2">
          <p className="text-section-label">Values</p>
          <p className="text-xs text-lr-muted">Select the values you demonstrated this quarter and describe how</p>
          <ValueChipSelector
            companyValues={companyValues}
            value={valueAssessments}
            onChange={setValueAssessments}
            disabled={readOnly || isPending}
          />
        </div>
      </section>

      {/* ── NEXT QUARTER SECTION ── */}
      <section className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-5 space-y-6">
        <div>
          <h3 className="text-card-title text-lr-accent">Next Quarter</h3>
          <p className="text-xs text-lr-muted mt-1">Set your goals and first-month MITs</p>
        </div>

        <div className="space-y-3">
          <p className="text-section-label">Goals</p>
          <div className="space-y-3">
            {nextGoals.map((goal, index) => (
              <div key={goal.id} className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                      <Label className="text-caption">Goal</Label>
                      <Input
                        value={goal.title}
                        onChange={(e) => updateNextGoal(index, { title: e.target.value })}
                        disabled={readOnly || isPending}
                        placeholder="What do you want to achieve next quarter?"
                        className="bg-lr-surface border-lr-border text-lr-text text-sm h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-caption">Description</Label>
                      <Textarea
                        value={goal.description}
                        onChange={(e) => updateNextGoal(index, { description: e.target.value })}
                        disabled={readOnly || isPending}
                        placeholder="Brief description or success criteria…"
                        className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[72px] resize-y"
                      />
                    </div>
                  </div>
                  {!readOnly && nextGoals.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeNextGoal(index)}
                      className="mt-1 text-lr-muted hover:text-lr-error transition-colors flex-shrink-0"
                      aria-label="Remove goal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addNextGoal}
                className="w-full gap-1.5 border-lr-accent text-lr-accent hover:bg-lr-accent-dim text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> New goal
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-section-label">First Month MITs</p>
          <p className="text-xs text-lr-muted">
            These will carry over to the review section of your first monthly check-in next quarter.
          </p>
          <MitPlanList
            value={nextMits}
            onChange={setNextMits}
            linkOptions={goalLinkOptions}
            linkLabel="Quarterly goal"
            noLinkLabel="Unrelated to quarterly goals"
            disabled={readOnly || isPending}
          />
        </div>
      </section>

      {error && (
        <div className="rounded-[var(--radius-lr)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={save}
            disabled={isPending}
            variant="outline"
            className="border-lr-border text-lr-text hover:bg-lr-surface"
          >
            {isPending ? 'Saving…' : 'Save Draft'}
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="bg-lr-accent hover:bg-lr-accent/90 text-white"
          >
            {isPending ? 'Submitting…' : 'Submit Check-in'}
          </Button>
          {savedAt && (
            <span className="text-xs text-lr-muted">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track" && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors only in `quarterly-checkin-actions.ts` (next task).

- [ ] **Step 3: Commit**

```bash
git -C "/Users/max/Lunartrack Hackaton/lunar-track" add src/components/checkins/QuarterlyCheckinEmployeeForm.tsx
git -C "/Users/max/Lunartrack Hackaton/lunar-track" commit -m "feat(quarterly): rewrite QuarterlyCheckinEmployeeForm with two-section layout"
```

---

## Task 12: Update Quarterly Check-in Server Action + Carry Logic

**Files:**
- Modify: `src/lib/actions/quarterly-checkin-actions.ts`

Update `upsertQuarterlyCheckinEmployee` for new fields and add carry logic to seed the first monthly check-in of next quarter.

- [ ] **Step 1: Replace `upsertQuarterlyCheckinEmployee` (keep `upsertQuarterlyCheckinManager` unchanged)**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Profile, QuarterlyCheckin, PerformancePeriod, QuarterlyGoal, QuarterlyGoalReview, ValueAssessment, PlanMit, ReviewMit } from '@/lib/types/database'
import {
  notifyManagerCheckinSubmitted,
  notifyEmployeeCheckinReviewed,
} from '@/lib/notifications'

type ActionResult = { success: true; id?: string } | { error: string }

async function getCallerProfile(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single()
  return data as Profile | null
}

const goalReviewSchema = z.object({
  id: z.string(),
  title: z.string().max(300),
  description: z.string().max(1000).default(''),
  status: z.enum(['achieved', 'not_achieved']).nullable().default(null),
})

const nextGoalSchema = z.object({
  id: z.string(),
  title: z.string().max(300),
  description: z.string().max(1000).default(''),
})

const planMitSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(500).default(''),
  okr_id: z.string().nullable().default(null),
  okr_label: z.string().nullable().default(null),
})

const valueAssessmentSchema = z.object({
  value_id: z.string(),
  value_name: z.string(),
  description: z.string().max(2000).default(''),
})

export async function upsertQuarterlyCheckinEmployee(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  const schema = z.object({
    periodId: z.string().uuid(),
    goals: z.string().default('[]'),
    next_quarter_goals: z.string().default('[]'),
    next_quarter_mits: z.string().default('[]'),
    value_assessments: z.string().default('[]'),
    submit: z.string().optional(),
  })

  const parsed = schema.safeParse({
    periodId: formData.get('periodId'),
    goals: formData.get('goals') || '[]',
    next_quarter_goals: formData.get('next_quarter_goals') || '[]',
    next_quarter_mits: formData.get('next_quarter_mits') || '[]',
    value_assessments: formData.get('value_assessments') || '[]',
    submit: formData.get('submit') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  let goals: QuarterlyGoalReview[]
  let nextQuarterGoals: QuarterlyGoal[]
  let nextQuarterMits: PlanMit[]
  let valueAssessments: ValueAssessment[]
  try {
    goals = z.array(goalReviewSchema).parse(JSON.parse(parsed.data.goals))
    nextQuarterGoals = z.array(nextGoalSchema).parse(JSON.parse(parsed.data.next_quarter_goals))
    nextQuarterMits = z.array(planMitSchema).parse(JSON.parse(parsed.data.next_quarter_mits))
    valueAssessments = z.array(valueAssessmentSchema).parse(JSON.parse(parsed.data.value_assessments))
  } catch {
    return { error: 'Invalid form data' }
  }

  const isSubmit = parsed.data.submit === 'true'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('quarterly_checkins')
    .select('id, employee_submitted_at')
    .eq('employee_id', caller.id)
    .eq('period_id', parsed.data.periodId)
    .maybeSingle()

  if (existing?.employee_submitted_at) {
    return { error: 'Quarterly check-in already submitted. Editing is not allowed.' }
  }

  const payload: Record<string, unknown> = {
    employee_id: caller.id,
    period_id: parsed.data.periodId,
    goals,
    next_quarter_goals: nextQuarterGoals,
    next_quarter_mits: nextQuarterMits,
    value_assessments: valueAssessments,
    updated_at: new Date().toISOString(),
  }
  if (isSubmit) payload.employee_submitted_at = new Date().toISOString()

  let checkinId: string
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('quarterly_checkins').update(payload).eq('id', existing.id)
    checkinId = existing.id
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newCheckin, error: insertError } = await (supabase as any)
      .from('quarterly_checkins').insert(payload).select('id').single()
    if (insertError) {
      if (insertError.code === '23505') return { error: 'A quarterly check-in for this period already exists' }
      return { error: 'Failed to create quarterly check-in: ' + insertError.message }
    }
    checkinId = (newCheckin as { id: string }).id
  }

  // On submit: carry next_quarter_mits into first monthly check-in of next period
  if (isSubmit && nextQuarterMits.some((m) => m.title.trim())) {
    await carryMitsToFirstMonthOfNextQuarter(supabase, {
      employeeId: caller.id,
      currentPeriodId: parsed.data.periodId,
      nextQuarterMits,
    })
  }

  revalidatePath('/checkins')
  revalidatePath('/quarterly-checkins')
  revalidatePath(`/quarterly-checkins/${checkinId}`)
  revalidatePath('/dashboard')

  if (isSubmit && caller.manager_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: periodRaw } = await (supabase as any)
      .from('performance_periods').select('year, quarter').eq('id', parsed.data.periodId).single()
    const period = periodRaw as Pick<PerformancePeriod, 'year' | 'quarter'> | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mgr } = await (supabase as any)
      .from('profiles').select('email, full_name').eq('id', caller.manager_id).single()
    if (mgr) {
      const { data: { user } } = await supabase.auth.getUser()
      void notifyManagerCheckinSubmitted({
        managerEmail: mgr.email,
        managerName: mgr.full_name,
        employeeName: caller.full_name ?? (user?.email ?? 'Employee'),
        month: period ? `Q${period.quarter}` : 'Quarterly',
        year: period?.year ?? new Date().getFullYear(),
        checkinId,
      })
    }
  }

  return { success: true, id: checkinId }
}

async function carryMitsToFirstMonthOfNextQuarter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: { employeeId: string; currentPeriodId: string; nextQuarterMits: PlanMit[] }
) {
  const { employeeId, currentPeriodId, nextQuarterMits } = opts

  // Find the next performance period
  const { data: currentPeriod } = await supabase
    .from('performance_periods').select('year, quarter').eq('id', currentPeriodId).single()
  if (!currentPeriod) return

  const nextQuarter = currentPeriod.quarter === 4 ? 1 : currentPeriod.quarter + 1
  const nextYear = currentPeriod.quarter === 4 ? currentPeriod.year + 1 : currentPeriod.year

  const { data: nextPeriod } = await supabase
    .from('performance_periods')
    .select('id')
    .eq('year', nextYear)
    .eq('quarter', nextQuarter)
    .maybeSingle()
  if (!nextPeriod) return

  const carriedMits: ReviewMit[] = nextQuarterMits.map((m) => ({
    title: m.title,
    description: m.description,
    okr_id: m.okr_id,
    okr_label: m.okr_label,
    status: 'not_achieved' as const,
  }))

  // Target: month 1 of the new period
  const { data: firstMonthCheckin } = await supabase
    .from('checkins')
    .select('id, employee_submitted_at')
    .eq('employee_id', employeeId)
    .eq('period_id', nextPeriod.id)
    .eq('month', 1)
    .maybeSingle()

  if (firstMonthCheckin) {
    if (!firstMonthCheckin.employee_submitted_at) {
      await supabase.from('checkins')
        .update({ mits: carriedMits, updated_at: new Date().toISOString() })
        .eq('id', firstMonthCheckin.id)
    }
  } else {
    await supabase.from('checkins').insert({
      employee_id: employeeId,
      period_id: nextPeriod.id,
      month: 1,
      year: nextYear,
      mits: carriedMits,
    })
  }
}
```

- [ ] **Step 2: Type-check the whole project**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track" && npx tsc --noEmit 2>&1 | head -60
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git -C "/Users/max/Lunartrack Hackaton/lunar-track" add src/lib/actions/quarterly-checkin-actions.ts
git -C "/Users/max/Lunartrack Hackaton/lunar-track" commit -m "feat(quarterly): update quarterly action with v2 fields and first-month carry logic"
```

---

## Task 13: Verify in Browser

- [ ] **Step 1: Ensure the dev server is running**

```bash
cd "/Users/max/Lunartrack Hackaton/lunar-track" && npm run dev
```

Expected: server starts on port 3001 (or 3000 if free).

- [ ] **Step 2: Sign in and open a monthly check-in**

Navigate to `http://localhost:3001/checkins/new`. Verify:
- Review section shows with MIT list (achieved/not-achieved toggles)
- Done well / done differently text areas visible
- Next Month section below with MIT list and OKR dropdown including "Unrelated to quarterly OKRs"

- [ ] **Step 3: Open a quarterly check-in**

Navigate to `http://localhost:3001/quarterly-checkins/new`. Verify:
- Review section: Goal Achievements list, Done Well/Done Differently auto-pull panel, Values chip selector
- Next Quarter section: Goals list with + New goal, First Month MITs with goal link dropdown

- [ ] **Step 4: Test carry logic**

Submit a monthly check-in with next-month MITs. Open or create the following month's check-in and verify the review MITs are pre-populated with status "Not achieved".
