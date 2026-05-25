import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ScoreDistributionChart from '@/components/analytics/ScoreDistributionChart'
import PerformerCurveChart from '@/components/analytics/PerformerCurveChart'
import ValueUsageChart from '@/components/analytics/ValueUsageChart'
import MoodTrendOrgChart, { ENERGY_LABEL, PROD_LABEL } from '@/components/analytics/MoodTrendOrgChart'
import type {
  Profile, CompanyValue, QuarterlyScore, QuarterlyCheckin,
  ValueAssessment, ValueSelfAssessment, PerformancePeriod,
} from '@/lib/types/database'

export const metadata: Metadata = { title: 'Analytics · LunarTrack' }
export const dynamic = 'force-dynamic'

function pct(n: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((n / total) * 100)}%`
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single()
  const profile = profileRaw as Profile | null
  if (!profile || profile.role !== 'HR_ADMIN') redirect('/dashboard')

  // ── Fetch all data in parallel ────────────────────────────────────────────
  const [
    profilesRes, periodsRes, scoresRes, qCheckinsRes, checkinsRes, valuesRes,
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('profiles').select('id, full_name, email, role, manager_id').order('full_name'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('performance_periods').select('*').order('year', { ascending: false }).order('quarter', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('quarterly_scores').select('*').order('created_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('quarterly_checkins').select('employee_id, period_id, value_assessments, value_self_assessments, goals, employee_submitted_at'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('checkins').select('employee_id, period_id, month, year, mood_energy, mood_productivity, employee_submitted_at').order('year', { ascending: false }).order('month', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('company_values').select('*').order('sort_order'),
  ])

  const allProfiles = (profilesRes.data ?? []) as Pick<Profile, 'id' | 'full_name' | 'email' | 'role' | 'manager_id'>[]
  const periods = (periodsRes.data ?? []) as PerformancePeriod[]
  const allScores = (scoresRes.data ?? []) as QuarterlyScore[]
  const allQCheckins = (qCheckinsRes.data ?? []) as Pick<QuarterlyCheckin, 'employee_id' | 'period_id' | 'value_assessments' | 'value_self_assessments' | 'goals' | 'employee_submitted_at'>[]
  const allCheckins = (checkinsRes.data ?? []) as { employee_id: string; period_id: string; month: number; year: number; mood_energy: string | null; mood_productivity: string | null; employee_submitted_at: string | null }[]
  const companyValues = (valuesRes.data ?? []) as CompanyValue[]

  const openPeriod = periods.find((p) => p.status === 'open') ?? null
  const employees = allProfiles.filter((p) => p.role === 'EMPLOYEE')
  const totalEmployees = employees.length

  // ── Check-in completion (current period, current month) ──────────────────
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const monthCheckins = allCheckins.filter(
    (c) => c.month === currentMonth && c.year === currentYear && c.employee_submitted_at
  )
  const checkinCompletionCount = new Set(monthCheckins.map((c) => c.employee_id)).size

  // Quarterly check-in completion (open period)
  const qSubmitted = openPeriod
    ? allQCheckins.filter((c) => c.period_id === openPeriod.id && c.employee_submitted_at).length
    : 0

  // ── Quarterly scores ──────────────────────────────────────────────────────
  // Latest score per employee
  const latestScoreByEmployee = new Map<string, QuarterlyScore>()
  for (const s of allScores) {
    if (!latestScoreByEmployee.has(s.employee_id)) latestScoreByEmployee.set(s.employee_id, s)
  }

  function overallScore(s: QuarterlyScore): number | null {
    const vals = [s.professional_mastery, s.okrs_stretch_goals, s.behaviours_values].filter((v): v is number => v !== null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  const scoredEmployees = employees
    .map((e) => {
      const s = latestScoreByEmployee.get(e.id)
      const overall = s ? overallScore(s) : null
      return { ...e, score: overall, raw: s ?? null }
    })
    .filter((e) => e.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

  const avgScore = scoredEmployees.length
    ? scoredEmployees.reduce((s, e) => s + (e.score ?? 0), 0) / scoredEmployees.length
    : null

  // Score distribution (1–5, integer buckets)
  const scoreDistribution = [1, 2, 3, 4, 5].map((n) => ({
    score: String(n),
    count: scoredEmployees.filter((e) => {
      const s = e.score ?? 0
      return n === 5 ? s >= 4.5 : s >= n - 0.5 && s < n + 0.5
    }).length,
  }))

  // Performer curve (0.5-step buckets 1.0 → 5.0)
  const buckets = Array.from({ length: 9 }, (_, i) => (1 + i * 0.5).toFixed(1))
  const curveData = buckets.map((b) => {
    const bv = parseFloat(b)
    return {
      score: b,
      count: scoredEmployees.filter((e) => {
        const s = e.score ?? 0
        return s >= bv - 0.25 && s < bv + 0.25
      }).length,
    }
  })

  // ── Values usage ──────────────────────────────────────────────────────────
  const valueUsage = new Map<string, number>()
  for (const qc of allQCheckins) {
    const v2 = (qc.value_assessments as ValueAssessment[] | null) ?? []
    for (const va of v2) { if (va.value_id) valueUsage.set(va.value_id, (valueUsage.get(va.value_id) ?? 0) + 1) }
    const v1 = (qc.value_self_assessments as ValueSelfAssessment[] | null) ?? []
    for (const va of v1) { if (va.value_id) valueUsage.set(va.value_id, (valueUsage.get(va.value_id) ?? 0) + 1) }
  }

  const valueChartData = companyValues
    .map((v) => ({ id: v.id, name: v.name, count: valueUsage.get(v.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)

  const mostUsedValue = valueChartData[0] ?? null
  const leastUsedValue = [...valueChartData].sort((a, b) => a.count - b.count)[0] ?? null

  // ── Org mood trend (avg per month, last 6 months) ─────────────────────────
  const moodMap = new Map<string, { energySum: number; prodSum: number; n: number }>()
  for (const c of allCheckins) {
    if (!c.mood_energy && !c.mood_productivity) continue
    const key = `${c.year}-${String(c.month).padStart(2, '0')}`
    const existing = moodMap.get(key) ?? { energySum: 0, prodSum: 0, n: 0 }
    existing.energySum += ENERGY_LABEL[c.mood_energy ?? ''] ?? 0
    existing.prodSum += PROD_LABEL[c.mood_productivity ?? ''] ?? 0
    existing.n += 1
    moodMap.set(key, existing)
  }
  const moodTrend = Array.from(moodMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([key, v]) => ({
      period: key,
      energy: v.n ? parseFloat((v.energySum / v.n).toFixed(2)) : 0,
      productivity: v.n ? parseFloat((v.prodSum / v.n).toFixed(2)) : 0,
    }))

  // ── Goal achievement (from quarterly check-in goals JSONB) ────────────────
  let goalsAchieved = 0, goalsNotAchieved = 0, goalsInProgress = 0
  for (const qc of allQCheckins) {
    const goals = (qc.goals as { status: string | null }[] | null) ?? []
    for (const g of goals) {
      if (g.status === 'achieved') goalsAchieved++
      else if (g.status === 'not_achieved') goalsNotAchieved++
      else goalsInProgress++
    }
  }
  const totalGoals = goalsAchieved + goalsNotAchieved + goalsInProgress

  // ── Goal setting rate (employees with OKRs in open period) ───────────────
  // We use scored employees as a proxy — employees with any qcheckin goals set
  const employeesWithGoals = openPeriod
    ? new Set(allQCheckins.filter((c) => c.period_id === openPeriod.id && (c.goals as unknown[])?.length).map((c) => c.employee_id)).size
    : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-page-title">Analytics</h1>
        <p className="text-body text-lr-muted mt-1">
          Organisation-wide performance insights{openPeriod ? ` · ${openPeriod.name}` : ''}
        </p>
      </div>

      {/* ── Overview stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Employees', value: String(totalEmployees), sub: 'active accounts' },
          {
            label: 'Check-in Rate',
            value: pct(checkinCompletionCount, totalEmployees),
            sub: `${checkinCompletionCount} of ${totalEmployees} submitted this month`,
          },
          {
            label: 'Avg Score',
            value: avgScore !== null ? avgScore.toFixed(1) : '—',
            sub: `across ${scoredEmployees.length} scored employees`,
          },
          {
            label: 'Goals Set',
            value: pct(employeesWithGoals, totalEmployees),
            sub: `${employeesWithGoals} employees have goals`,
          },
        ].map((card) => (
          <div key={card.label} className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)]">
            <p className="text-kicker">{card.label}</p>
            <p className="text-3xl font-bold text-lr-text mt-1">{card.value}</p>
            <p className="text-xs text-lr-muted mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Performance Distribution + Performer Curve ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)]">
          <div className="mb-4">
            <p className="text-card-title">Score Distribution</p>
            <p className="text-xs text-lr-muted mt-0.5">Employees by quarterly score band (1–5)</p>
          </div>
          {scoredEmployees.length === 0 ? (
            <p className="text-sm text-lr-muted/60 italic">No quarterly scores yet.</p>
          ) : (
            <ScoreDistributionChart distribution={scoreDistribution} />
          )}
        </div>

        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)]">
          <div className="mb-4">
            <p className="text-card-title">Performer Distribution Curve</p>
            <p className="text-xs text-lr-muted mt-0.5">Score spread across the team — left = low, right = high</p>
          </div>
          {scoredEmployees.length === 0 ? (
            <p className="text-sm text-lr-muted/60 italic">No quarterly scores yet.</p>
          ) : (
            <PerformerCurveChart data={curveData} avg={avgScore ?? 0} />
          )}
        </div>
      </div>

      {/* ── Employee Leaderboard ── */}
      {scoredEmployees.length > 0 && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-card-title">Employee Performance</p>
              <p className="text-xs text-lr-muted mt-0.5">Ranked by latest quarterly score</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-lr-border/50">
                  <th className="text-left text-caption pb-2 font-normal">#</th>
                  <th className="text-left text-caption pb-2 font-normal">Employee</th>
                  <th className="text-right text-caption pb-2 font-normal">Mastery</th>
                  <th className="text-right text-caption pb-2 font-normal">Goals</th>
                  <th className="text-right text-caption pb-2 font-normal">Values</th>
                  <th className="text-right text-caption pb-2 font-normal">Overall</th>
                </tr>
              </thead>
              <tbody>
                {scoredEmployees.map((e, i) => {
                  const s = e.raw!
                  const overall = e.score!
                  const color = overall >= 4 ? 'text-lr-accent' : overall >= 3 ? 'text-lr-cyan' : overall >= 2 ? 'text-lr-gold' : 'text-lr-error'
                  return (
                    <tr key={e.id} className="border-b border-lr-border/20 hover:bg-lr-surface/30 transition-colors">
                      <td className="py-2.5 pr-3 text-lr-muted/50 text-xs">{i + 1}</td>
                      <td className="py-2.5">
                        <span className="text-lr-text font-medium">{e.full_name ?? e.email}</span>
                      </td>
                      <td className="py-2.5 text-right text-lr-muted">{s.professional_mastery ?? '—'}</td>
                      <td className="py-2.5 text-right text-lr-muted">{s.okrs_stretch_goals ?? '—'}</td>
                      <td className="py-2.5 text-right text-lr-muted">{s.behaviours_values ?? '—'}</td>
                      <td className={`py-2.5 text-right font-bold ${color}`}>{overall.toFixed(1)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Values Analytics ── */}
      {companyValues.length > 0 && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)]">
          <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-card-title">Values Usage</p>
              <p className="text-xs text-lr-muted mt-0.5">How often each value was cited across quarterly check-ins</p>
            </div>
            <div className="flex gap-3">
              {mostUsedValue && mostUsedValue.count > 0 && (
                <div className="rounded-[var(--radius-lr)] border border-lr-accent/20 bg-lr-accent-dim px-3 py-1.5 text-xs">
                  <span className="text-lr-muted">Most cited · </span>
                  <span className="text-lr-accent font-medium">{mostUsedValue.name}</span>
                  <span className="text-lr-muted/70"> ×{mostUsedValue.count}</span>
                </div>
              )}
              {leastUsedValue && leastUsedValue.count < (mostUsedValue?.count ?? 0) && (
                <div className="rounded-[var(--radius-lr)] border border-lr-gold/20 bg-lr-gold-dim px-3 py-1.5 text-xs">
                  <span className="text-lr-muted">Least cited · </span>
                  <span className="text-lr-gold font-medium">{leastUsedValue.name}</span>
                  <span className="text-lr-muted/70"> ×{leastUsedValue.count}</span>
                </div>
              )}
            </div>
          </div>
          <ValueUsageChart data={valueChartData} />
        </div>
      )}

      {/* ── Goal Achievement ── */}
      {totalGoals > 0 && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)]">
          <p className="text-card-title mb-4">Goal Achievement</p>
          <div className="flex items-center gap-6 flex-wrap">
            {[
              { label: 'Achieved', count: goalsAchieved, color: 'bg-lr-success', text: 'text-lr-success' },
              { label: 'Not achieved', count: goalsNotAchieved, color: 'bg-lr-error', text: 'text-lr-error' },
              { label: 'In progress', count: goalsInProgress, color: 'bg-lr-accent/60', text: 'text-lr-accent' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-sm ${item.color}`} />
                <div>
                  <p className={`text-xl font-bold ${item.text}`}>{pct(item.count, totalGoals)}</p>
                  <p className="text-xs text-lr-muted">{item.label} · {item.count}</p>
                </div>
              </div>
            ))}
            {/* Bar */}
            <div className="flex-1 min-w-48 h-3 rounded-full overflow-hidden flex">
              <div className="bg-lr-success transition-all" style={{ width: pct(goalsAchieved, totalGoals) }} />
              <div className="bg-lr-error transition-all" style={{ width: pct(goalsNotAchieved, totalGoals) }} />
              <div className="bg-lr-accent/60 transition-all" style={{ width: pct(goalsInProgress, totalGoals) }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Org Mood Trend ── */}
      {moodTrend.length > 0 && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)]">
          <div className="mb-4">
            <p className="text-card-title">Org Mood Trend</p>
            <p className="text-xs text-lr-muted mt-0.5">Average energy &amp; productivity across the team (last 6 months)</p>
          </div>
          <MoodTrendOrgChart data={moodTrend} />
          <div className="mt-3 flex gap-6 text-xs text-lr-muted">
            <span>Energy: 1=Terrible · 2=Meh · 3=Okay · 4=Great</span>
            <span>Productivity: 1=Wasted · 2=Fine · 3=Ludicrous</span>
          </div>
        </div>
      )}

      {/* ── Quarterly check-in engagement ── */}
      {openPeriod && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)]">
          <p className="text-card-title mb-4">Quarterly Engagement · {openPeriod.name}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-lr-text">{pct(qSubmitted, totalEmployees)}</p>
              <p className="text-xs text-lr-muted mt-0.5">{qSubmitted} of {totalEmployees} submitted quarterly review</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-lr-text">{pct(checkinCompletionCount, totalEmployees)}</p>
              <p className="text-xs text-lr-muted mt-0.5">{checkinCompletionCount} of {totalEmployees} submitted this month&apos;s check-in</p>
            </div>
          </div>
          {/* Progress bars */}
          <div className="mt-4 space-y-2">
            <div>
              <div className="flex justify-between text-xs text-lr-muted mb-1">
                <span>Quarterly reviews</span><span>{pct(qSubmitted, totalEmployees)}</span>
              </div>
              <div className="h-2 rounded-full bg-lr-border overflow-hidden">
                <div className="h-full bg-lr-accent rounded-full transition-all" style={{ width: pct(qSubmitted, totalEmployees) }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-lr-muted mb-1">
                <span>Monthly check-ins</span><span>{pct(checkinCompletionCount, totalEmployees)}</span>
              </div>
              <div className="h-2 rounded-full bg-lr-border overflow-hidden">
                <div className="h-full bg-lr-cyan rounded-full transition-all" style={{ width: pct(checkinCompletionCount, totalEmployees) }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
