import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PeriodFilter from '@/components/admin/PeriodFilter'
import type { Profile, PerformancePeriod, QuarterlyScore, ValueRating } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

type ScoreRow = QuarterlyScore & {
  employee: Pick<Profile, 'id' | 'full_name' | 'email' | 'manager_id'>
  period: Pick<PerformancePeriod, 'id' | 'name' | 'year' | 'quarter'>
}

type ManagerStats = {
  managerId: string
  managerName: string
  employees: {
    id: string
    name: string
    pm: number
    okrs: number
    bv: number
    avg: number
  }[]
  avgPm: number
  avgOkrs: number
  avgBv: number
  avgOverall: number
  count: number
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function ScoreBar({ value, max = 5 }: { value: number; max?: number }) {
  const pct = (value / max) * 100
  const color = value >= 4 ? 'bg-lr-cyan' : value >= 3 ? 'bg-lr-accent' : 'bg-lr-error'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 bg-lr-surface rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-lr-text w-6 text-right">{value.toFixed(1)}</span>
    </div>
  )
}

export default async function CalibrationPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: periodParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any).from('profiles').select('role').eq('id', user.id).single()
  const profile = profileRaw as Pick<Profile, 'role'> | null
  if (!profile || profile.role !== 'HR_ADMIN') redirect('/dashboard')

  // Fetch all periods for the filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: periodsRaw } = await (supabase as any)
    .from('performance_periods')
    .select('id, name, year, quarter, status')
    .order('year', { ascending: false })
    .order('quarter', { ascending: false })
  const periods = (periodsRaw ?? []) as PerformancePeriod[]

  // Resolve selected period: URL param → open period → latest
  const selectedPeriod = (periodParam ? periods.find((p) => p.id === periodParam) : null)
    ?? periods.find((p) => p.status === 'open')
    ?? periods[0]
    ?? null

  // Fetch quarterly scores for selected period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoresQuery = (supabase as any)
    .from('quarterly_scores')
    .select('*, employee:profiles!employee_id(id,full_name,email,manager_id), period:performance_periods!period_id(id,name,year,quarter)')
    .order('created_at', { ascending: false })

  if (selectedPeriod) {
    scoresQuery.eq('period_id', selectedPeriod.id)
  }

  const { data: scoresRaw } = await scoresQuery
  const scores = (scoresRaw ?? []) as ScoreRow[]

  // Fetch all managers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: managersRaw } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, email')
    .in('role', ['MANAGER', 'HR_ADMIN'])
  const managers = (managersRaw ?? []) as Pick<Profile, 'id' | 'full_name' | 'email'>[]
  const managerMap: Record<string, string> = {}
  for (const m of managers) {
    managerMap[m.id] = m.full_name ?? m.email
  }

  // Group scores by manager
  const byManager: Record<string, ScoreRow[]> = {}
  for (const s of scores) {
    const managerId = s.employee.manager_id ?? 'unassigned'
    if (!byManager[managerId]) byManager[managerId] = []
    byManager[managerId].push(s)
  }

  const managerStats: ManagerStats[] = Object.entries(byManager).map(([managerId, mScores]) => {
    const employees = mScores.map((s) => ({
      id: s.employee.id,
      name: s.employee.full_name ?? s.employee.email,
      pm: s.professional_mastery ?? 0,
      okrs: s.okrs_stretch_goals ?? 0,
      bv: s.behaviours_values ?? 0,
      avg: avg([s.professional_mastery ?? 0, s.okrs_stretch_goals ?? 0, s.behaviours_values ?? 0]),
    }))

    return {
      managerId,
      managerName: managerMap[managerId] ?? 'Unassigned',
      employees,
      avgPm: avg(employees.map((e) => e.pm)),
      avgOkrs: avg(employees.map((e) => e.okrs)),
      avgBv: avg(employees.map((e) => e.bv)),
      avgOverall: avg(employees.map((e) => e.avg)),
      count: employees.length,
    }
  }).sort((a, b) => b.avgOverall - a.avgOverall)

  // Company-wide averages
  const allEmployees = managerStats.flatMap((m) => m.employees)
  const companyAvgPm = avg(allEmployees.map((e) => e.pm))
  const companyAvgOkrs = avg(allEmployees.map((e) => e.okrs))
  const companyAvgBv = avg(allEmployees.map((e) => e.bv))
  const companyAvgOverall = avg(allEmployees.map((e) => e.avg))

  // Score distribution
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const s of scores) {
    if (s.professional_mastery) distribution[s.professional_mastery] = (distribution[s.professional_mastery] ?? 0) + 1
    if (s.okrs_stretch_goals) distribution[s.okrs_stretch_goals] = (distribution[s.okrs_stretch_goals] ?? 0) + 1
    if (s.behaviours_values) distribution[s.behaviours_values] = (distribution[s.behaviours_values] ?? 0) + 1
  }
  const distTotal = Object.values(distribution).reduce((a, b) => a + b, 0)

  const SCORE_LABELS: Record<number, string> = {
    1: 'Significantly below', 2: 'Below expectations', 3: 'Meets', 4: 'Exceeds', 5: 'Outstanding',
  }

  // Per-value distribution: aggregate across all scores' value_ratings JSONB arrays
  type ValueAggregate = {
    valueName: string
    ratings: number[]
    distribution: Record<number, number>
  }
  const valueAggregates: Record<string, ValueAggregate> = {}
  for (const s of scores) {
    const vrs = (s.value_ratings ?? []) as ValueRating[]
    for (const vr of vrs) {
      if (!vr.value_name || typeof vr.rating !== 'number') continue
      if (!valueAggregates[vr.value_name]) {
        valueAggregates[vr.value_name] = {
          valueName: vr.value_name,
          ratings: [],
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        }
      }
      const agg = valueAggregates[vr.value_name]
      agg.ratings.push(vr.rating)
      agg.distribution[vr.rating] = (agg.distribution[vr.rating] ?? 0) + 1
    }
  }
  const valueAggregateList = Object.values(valueAggregates)
    .map((a) => ({
      ...a,
      avg: avg(a.ratings),
      total: a.ratings.length,
    }))
    .sort((a, b) => b.avg - a.avg)

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/scores" className="text-xs text-lr-muted hover:text-lr-accent">← Scores</Link>
          </div>
          <h1 className="text-page-title">Score Calibration</h1>
          <p className="text-body text-lr-muted mt-1">
            Compare manager scoring patterns · {selectedPeriod?.name ?? 'All periods'}
          </p>
        </div>
        {periods.length > 0 && (
          <PeriodFilter
            periods={periods}
            selectedId={selectedPeriod?.id}
            basePath="/admin/scores/calibration"
          />
        )}
      </div>

      {scores.length === 0 ? (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-12 text-center">
          <p className="text-body text-lr-muted">No quarterly scores for {selectedPeriod?.name ?? 'this period'} yet.</p>
        </div>
      ) : (
        <>
          {/* Company overview */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Company avg', value: companyAvgOverall, color: 'text-lr-accent' },
              { label: 'Prof. Mastery', value: companyAvgPm, color: 'text-lr-cyan' },
              { label: 'Goals', value: companyAvgOkrs, color: 'text-lr-gold' },
              { label: 'Behaviours/Values', value: companyAvgBv, color: 'text-lr-text' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-4">
                <p className="text-caption mb-1">{stat.label}</p>
                <p className={`text-3xl font-bold ${stat.color}`}>{stat.value.toFixed(2)}</p>
                <p className="text-xs text-lr-muted mt-1">across {allEmployees.length} scores</p>
              </div>
            ))}
          </div>

          {/* Score distribution */}
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6">
            <h2 className="text-card-title mb-4">Rating Distribution (all dimensions)</h2>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((score) => {
                const count = distribution[score] ?? 0
                const pct = distTotal > 0 ? (count / distTotal) * 100 : 0
                const barColor = score >= 4 ? 'bg-lr-cyan' : score >= 3 ? 'bg-lr-accent' : 'bg-lr-error'
                return (
                  <div key={score} className="flex items-center gap-3">
                    <span className="text-xs text-lr-muted w-4 text-right font-bold">{score}</span>
                    <span className="text-xs text-lr-muted w-32 shrink-0">{SCORE_LABELS[score]}</span>
                    <div className="flex-1 h-5 bg-lr-surface rounded overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-lr-muted w-20 text-right">
                      {count} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Per-Value Distribution */}
          {valueAggregateList.length > 0 && (
            <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6">
              <h2 className="text-card-title mb-1">Per-Value Distribution</h2>
              <p className="text-xs text-lr-muted mb-4">
                Average rating and distribution per BCOMM company value across all scored employees.
              </p>
              <div className="space-y-5">
                {valueAggregateList.map((va) => (
                  <div key={va.valueName} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold text-lr-text">{va.valueName}</p>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xl font-bold ${
                          va.avg >= 4 ? 'text-lr-cyan' : va.avg >= 3 ? 'text-lr-accent' : 'text-lr-error'
                        }`}>
                          {va.avg.toFixed(2)}
                        </span>
                        <span className="text-xs text-lr-muted">/ 5 · {va.total} ratings</span>
                      </div>
                    </div>
                    <ScoreBar value={va.avg} />
                    {/* Distribution bars (mini) */}
                    <div className="flex gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const count = va.distribution[n] ?? 0
                        const pct = va.total > 0 ? (count / va.total) * 100 : 0
                        const color = n >= 4 ? 'bg-lr-cyan' : n >= 3 ? 'bg-lr-accent' : 'bg-lr-error'
                        return (
                          <div key={n} className="flex-1" title={`Rating ${n}: ${count} (${pct.toFixed(0)}%)`}>
                            <div className="h-2 bg-lr-surface rounded overflow-hidden">
                              <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-[10px] text-lr-muted text-center mt-0.5">{n}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By manager */}
          <div className="space-y-4">
            <h2 className="text-card-title">By Manager</h2>
            {managerStats.map((ms) => {
              const diffFromCompany = ms.avgOverall - companyAvgOverall
              const isHighScorer = diffFromCompany > 0.5
              const isLowScorer = diffFromCompany < -0.5
              return (
                <div
                  key={ms.managerId}
                  className={`rounded-[var(--radius-lr-lg)] border bg-lr-glass backdrop-blur-[8px] p-5 ${
                    isHighScorer ? 'border-lr-cyan/30' : isLowScorer ? 'border-lr-error/30' : 'border-lr-border'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-lr-text">{ms.managerName}</h3>
                      <p className="text-xs text-lr-muted">{ms.count} employee{ms.count !== 1 ? 's' : ''} scored</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-lr-text">{ms.avgOverall.toFixed(2)}</p>
                      <p className={`text-xs font-medium ${
                        isHighScorer ? 'text-lr-cyan' : isLowScorer ? 'text-lr-error' : 'text-lr-muted'
                      }`}>
                        {diffFromCompany >= 0 ? '+' : ''}{diffFromCompany.toFixed(2)} vs avg
                        {isHighScorer && ' ↑ High scorer'}
                        {isLowScorer && ' ↓ Low scorer'}
                      </p>
                    </div>
                  </div>

                  {/* Dimension bars */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {[
                      { label: 'Prof. Mastery', value: ms.avgPm },
                      { label: 'Goals', value: ms.avgOkrs },
                      { label: 'Behaviours/Values', value: ms.avgBv },
                    ].map((d) => (
                      <div key={d.label}>
                        <p className="text-xs text-lr-muted mb-1">{d.label}</p>
                        <ScoreBar value={d.value} />
                      </div>
                    ))}
                  </div>

                  {/* Individual employees */}
                  <div className="border-t border-lr-border pt-3">
                    <div className="space-y-1.5">
                      {ms.employees.map((e) => (
                        <div key={e.id} className="flex items-center justify-between text-xs">
                          <span className="text-lr-muted">{e.name}</span>
                          <div className="flex gap-3 text-lr-text">
                            <span title="Professional Mastery">PM {e.pm}</span>
                            <span title="Goals">Goal {e.okrs}</span>
                            <span title="Behaviours/Values">B/V {e.bv}</span>
                            <span className="font-semibold text-lr-accent">⌀ {e.avg.toFixed(1)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
