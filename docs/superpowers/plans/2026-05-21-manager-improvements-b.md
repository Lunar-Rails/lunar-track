# My Performance Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/my-performance` page that shows the authenticated employee their own quarterly scores where `visible_to_employee = true`, ordered newest-first, with a sidebar link visible to all non-admin roles.

**Architecture:** A Server Component at `src/app/(protected)/my-performance/page.tsx` fetches `quarterly_scores` joined to `performance_periods` via a single Supabase query, renders one glass card per score, and shows an empty state when nothing is visible. The Sidebar client component gains a `TrendingUp` nav entry in the "My Work" section, conditionally shown when the user's role is `EMPLOYEE` or `MANAGER`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4 + LR Design System, Supabase SSR. No new dependencies.

---

## Task 1 — Server component page

**File:** `src/app/(protected)/my-performance/page.tsx`

### Steps

- [ ] Create the directory `src/app/(protected)/my-performance/`
- [ ] Create `src/app/(protected)/my-performance/page.tsx` with the content below
- [ ] Run compile check
- [ ] Commit

### File content

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { PerformancePeriod, QuarterlyScore } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const SCORE_LABELS: Record<number, string> = {
  1: 'Significantly below expectations',
  2: 'Below expectations',
  3: 'Meets expectations',
  4: 'Exceeds expectations',
  5: 'Outstanding',
}

type ScoreWithPeriod = QuarterlyScore & {
  period: Pick<PerformancePeriod, 'id' | 'name' | 'quarter' | 'year'>
}

export default async function MyPerformancePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: scoresRaw } = await (supabase as any)
    .from('quarterly_scores')
    .select('*, period:performance_periods!period_id(id,name,quarter,year)')
    .eq('employee_id', user.id)
    .eq('visible_to_employee', true)
    .order('year', { ascending: false, referencedTable: 'performance_periods' })
    .order('quarter', { ascending: false, referencedTable: 'performance_periods' })

  const scores = (scoresRaw ?? []) as ScoreWithPeriod[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">My Performance</h1>
        <p className="text-body text-lr-muted mt-1">
          Quarterly scores shared by your manager
        </p>
      </div>

      {scores.length === 0 ? (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-12 text-center">
          <p className="text-body text-lr-muted">
            Your manager hasn&apos;t shared any scores yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {scores.map((score) => (
            <div
              key={score.id}
              className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 space-y-4"
            >
              {/* Card header */}
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-lr-text">
                  {score.period.name}
                </h2>
                <span className="inline-flex items-center rounded-full border border-lr-border bg-lr-surface px-2.5 py-0.5 text-xs font-medium text-lr-accent">
                  Q{score.period.quarter} {score.period.year}
                </span>
              </div>

              {/* Score rows */}
              <div className="space-y-3">
                <ScoreRow
                  label="Professional Mastery"
                  value={score.professional_mastery}
                  notes={score.professional_mastery_notes}
                />
                <ScoreRow
                  label="Goals"
                  value={score.okrs_stretch_goals}
                  notes={score.okrs_stretch_goals_notes}
                />
                <ScoreRow
                  label="Behaviours & Values"
                  value={score.behaviours_values}
                  notes={score.behaviours_values_notes}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScoreRow({
  label,
  value,
  notes,
}: {
  label: string
  value: number | null
  notes: string | null
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        {value !== null ? (
          <span
            className="text-3xl font-bold text-lr-accent leading-none"
            title={SCORE_LABELS[value] ?? String(value)}
          >
            {value}
          </span>
        ) : (
          <span className="text-3xl font-bold text-lr-muted leading-none">—</span>
        )}
        <div>
          <p className="text-sm font-medium text-lr-text">{label}</p>
          {value !== null && (
            <p className="text-xs text-lr-muted">{SCORE_LABELS[value]}</p>
          )}
        </div>
      </div>
      {notes && (
        <p className="text-xs text-lr-muted pl-10">{notes}</p>
      )}
    </div>
  )
}
```

### Compile check command

```bash
cd /Users/max/Lunartrack\ Hackaton/lunar-track && npx tsc --noEmit 2>&1 | head -40
```

### Commit command

```bash
cd /Users/max/Lunartrack\ Hackaton/lunar-track && git add src/app/\(protected\)/my-performance/page.tsx && git commit -m "feat(employee): add My Performance page showing visible quarterly scores"
```

---

## Task 2 — Sidebar link

**File:** `src/components/layout/Sidebar.tsx`

### Steps

- [ ] Add `TrendingUp` to the lucide-react import in `Sidebar.tsx`
- [ ] Add `{ href: '/my-performance', label: 'My Performance', icon: TrendingUp }` to `myWorkNav` — visible to all roles (already shown to every user since `myWorkNav` is not role-gated)
- [ ] Run compile check
- [ ] Commit

### Exact diff

In `src/components/layout/Sidebar.tsx`:

**1. Import change** — add `TrendingUp` to the existing lucide-react import block:

```typescript
// Before
import {
  LayoutDashboard,
  Users,
  UserCog,
  Network,
  Calendar,
  BookOpen,
  ClipboardList,
  CalendarCheck,
  BarChart2,
  SlidersHorizontal,
} from 'lucide-react'

// After
import {
  LayoutDashboard,
  Users,
  UserCog,
  Network,
  Calendar,
  BookOpen,
  ClipboardList,
  CalendarCheck,
  BarChart2,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react'
```

**2. myWorkNav change** — append the My Performance entry:

```typescript
// Before
const myWorkNav: NavItem[] = [
  { href: '/checkins', label: 'Monthly Check-ins', icon: ClipboardList },
  { href: '/quarterly-checkins', label: 'Quarterly Reviews', icon: CalendarCheck },
  { href: '/guide', label: 'Framework Guide', icon: BookOpen },
]

// After
const myWorkNav: NavItem[] = [
  { href: '/checkins', label: 'Monthly Check-ins', icon: ClipboardList },
  { href: '/quarterly-checkins', label: 'Quarterly Reviews', icon: CalendarCheck },
  { href: '/my-performance', label: 'My Performance', icon: TrendingUp },
  { href: '/guide', label: 'Framework Guide', icon: BookOpen },
]
```

> Note: `myWorkNav` is rendered for all roles (no role guard). This is intentional — managers may also have quarterly scores set by their own manager. HR_ADMIN users land on admin screens and rarely use this section, but the link is harmless for them.

### Compile check command

```bash
cd /Users/max/Lunartrack\ Hackaton/lunar-track && npx tsc --noEmit 2>&1 | head -40
```

### Commit command

```bash
cd /Users/max/Lunartrack\ Hackaton/lunar-track && git add src/components/layout/Sidebar.tsx && git commit -m "feat(nav): add My Performance link to sidebar My Work section"
```
