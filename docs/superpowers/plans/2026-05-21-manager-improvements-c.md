# Manager Team Scoring Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Quarterly Scoring section to the existing `/team` page so managers can see at a glance which direct reports have been scored for the current open period, with direct links to the individual scoring page.

**Architecture:** The existing `team/page.tsx` Server Component already fetches the open period id; this plan extends that query to also fetch the full period row (including `name`) and adds a second Supabase query that pulls all `quarterly_scores` rows for the direct reports in the open period. The scoring section is rendered below the existing check-ins list using only the LR Design System tokens already in use; no new components or dependencies are introduced.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4 + LR Design System, Supabase SSR. No new dependencies.

---

## Task 1 — Extend data fetching and add Scoring section to `team/page.tsx`

**File:** `src/app/(protected)/team/page.tsx`

- [ ] **1.1 — Extend the open-period query to fetch `id` and `name`**

  Replace the existing open-period query (which only selects `id`):

  ```typescript
  // BEFORE
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: openPeriodRaw } = await (supabase as any)
    .from('performance_periods').select('id').eq('status', 'open').limit(1).maybeSingle()
  const openPeriodId = (openPeriodRaw as { id: string } | null)?.id ?? null
  ```

  With:

  ```typescript
  // AFTER
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: openPeriodRaw } = await (supabase as any)
    .from('performance_periods').select('id, name').eq('status', 'open').limit(1).maybeSingle()
  const openPeriod = openPeriodRaw as { id: string; name: string } | null
  const openPeriodId = openPeriod?.id ?? null
  ```

  Update all downstream references from `openPeriodId` to `openPeriod?.id ?? null` where needed (the existing quarterly_checkins block already uses `openPeriodId` — keep that variable as-is by assigning `const openPeriodId = openPeriod?.id ?? null` immediately after the cast, so no other existing code needs to change).

- [ ] **1.2 — Add `quarterly_scores` type and helper function**

  Add the following type alias and `scoringStatus` helper immediately after the existing `badgeFor` function (still inside the component body, before the `return`):

  ```typescript
  type QuarterlyScore = {
    employee_id: string
    period_id: string
    professional_mastery: number | null
    okrs_stretch_goals: number | null
    behaviours_values: number | null
  }

  function scoringStatus(score: QuarterlyScore | undefined): 'scored' | 'partial' | 'none' {
    if (!score) return 'none'
    if (score.professional_mastery && score.okrs_stretch_goals && score.behaviours_values) return 'scored'
    return 'partial'
  }
  ```

- [ ] **1.3 — Fetch `quarterly_scores` for all direct reports in the open period**

  Inside the existing `if (directReports.length > 0)` block, after the quarterly_checkins query, add:

  ```typescript
  const scoresMap: Record<string, QuarterlyScore> = {}

  if (openPeriodId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: scoresRaw } = await (supabase as any)
      .from('quarterly_scores')
      .select('employee_id, period_id, professional_mastery, okrs_stretch_goals, behaviours_values')
      .in('employee_id', reportIds)
      .eq('period_id', openPeriodId)

    for (const s of (scoresRaw ?? []) as QuarterlyScore[]) {
      scoresMap[s.employee_id] = s
    }
  }
  ```

  If `directReports.length === 0`, initialise `scoresMap` as an empty object before the block so the JSX can reference it unconditionally:

  ```typescript
  // Declare outside the if-block so JSX always has access
  const scoresMap: Record<string, QuarterlyScore> = {}
  ```

  Move the declaration before the `if (directReports.length > 0)` block and populate it inside.

- [ ] **1.4 — Add the Scoring section JSX**

  In the `return` statement, after the closing `</div>` of the existing direct-reports grid (and after the closing `</div>` of the outer `space-y-6` div is NOT reached yet), add a new section. The full addition goes between the existing reports grid and the outer closing `</div>`:

  ```tsx
  {/* ── Quarterly Scoring Section ── */}
  <div className="space-y-4 mt-8">
    {!openPeriod ? (
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 text-center">
        <p className="text-body text-lr-muted">No open period — quarterly scoring is not available.</p>
      </div>
    ) : (
      <>
        <h2 className="text-card-title">Quarterly Scoring — {openPeriod.name}</h2>
        {directReports.length === 0 ? (
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 text-center">
            <p className="text-body text-lr-muted">No direct reports assigned yet.</p>
          </div>
        ) : (
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-lr-border">
                  <th className="text-left px-4 py-3 text-lr-muted font-medium">Employee</th>
                  <th className="text-left px-4 py-3 text-lr-muted font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-lr-muted font-medium">PM / Goals / B&V</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {directReports.map((report) => {
                  const score = scoresMap[report.id]
                  const status = scoringStatus(score)

                  const statusBadge =
                    status === 'scored'
                      ? { cls: 'bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20', text: 'Scored' }
                      : status === 'partial'
                      ? { cls: 'bg-lr-gold-dim text-lr-gold border-lr-gold/20', text: 'Partial' }
                      : { cls: 'bg-lr-surface text-lr-muted border-lr-border', text: 'Not scored' }

                  return (
                    <tr key={report.id} className="border-b border-lr-border last:border-0 hover:bg-lr-surface/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={report.avatar_url ?? undefined} />
                            <AvatarFallback className="bg-lr-accent text-white text-xs">
                              {getInitials(report.full_name, report.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-lr-text">{report.full_name ?? report.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${statusBadge.cls}`}>
                          {statusBadge.text}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {score ? (
                          <span className="text-sm font-bold text-lr-accent">
                            {score.professional_mastery ?? '—'} / {score.okrs_stretch_goals ?? '—'} / {score.behaviours_values ?? '—'}
                          </span>
                        ) : (
                          <span className="text-lr-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/scoring/${report.id}/${openPeriod.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-lr-accent hover:text-lr-accent/80 transition-colors"
                        >
                          {status === 'none' ? 'Score →' : 'Edit →'}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </>
    )}
  </div>
  ```

---

## Task 2 — TypeScript check and commit

- [ ] **2.1 — Run TypeScript compiler check**

  ```bash
  cd "/Users/max/Lunartrack Hackaton/lunar-track" && npx tsc --noEmit 2>&1 | head -60
  ```

  Resolve any type errors before proceeding. Common issues to watch for:
  - `openPeriod` possibly-null references — guard with `openPeriod?.id` or the `!openPeriod` early-return pattern already used for the JSX branch.
  - `scoresMap` referenced before assignment if the declaration was left inside the `if` block — ensure it is declared outside.

- [ ] **2.2 — Commit**

  ```bash
  git add src/app/\(protected\)/team/page.tsx
  git commit -m "feat(team): add quarterly scoring hub section to team page

  Shows each direct report's scoring status (Scored / Partial / Not scored)
  for the current open period, with inline PM/Goals/B&V scores and a
  direct Score → / Edit → link to the individual scoring page.

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```
