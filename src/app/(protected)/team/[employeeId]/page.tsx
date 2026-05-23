import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import type {
  Checkin,
  Initiative,
  KeyResult,
  MoodEnergy,
  MoodProductivity,
  Okr,
  PerformancePeriod,
  PeriodStatus,
  Profile,
  QuarterlyCheckin,
  QuarterlyScore,
  SubordinateRow,
} from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getInitials(name: string | null, email: string): string {
  if (name) return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

type PipStatus = 'done' | 'late' | 'pending' | 'future'

function Pip({ label, status }: { label: string; status: PipStatus }) {
  const cls =
    status === 'done' ? 'bg-lr-success/15 text-lr-success border-lr-success/25' :
    status === 'late' ? 'bg-lr-error/10 text-lr-error border-lr-error/20' :
    status === 'future' ? 'bg-lr-surface/40 text-lr-muted/40 border-lr-border/30' :
    'bg-lr-surface text-lr-muted border-lr-border'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${cls}`}>
      {label}
    </span>
  )
}

type OkrWithProgress = Okr & {
  key_results: (KeyResult & { initiatives: Initiative[] })[]
}

interface ReviewMit {
  title: string
  description?: string | null
  okr_id?: string | null
  okr_label?: string | null
  status?: 'achieved' | 'not_achieved' | null
}

function quarterMonths(quarter: number): number[] {
  return [1, 2, 3].map((i) => (quarter - 1) * 3 + i)
}

function monthPipStatus(
  checkin: Checkin | undefined,
  month: number,
  periodStatus: PeriodStatus,
  periodYear: number,
  currentYear: number,
  currentMonth: number,
): PipStatus {
  if (checkin?.employee_submitted_at) return 'done'
  if (periodStatus === 'closed') return 'late'
  if (periodYear < currentYear) return 'late'
  if (periodYear > currentYear) return 'future'
  if (month > currentMonth) return 'future'
  if (month < currentMonth) return 'late'
  return 'pending'
}

function quarterlyPipStatus(qCheckin: QuarterlyCheckin | undefined, periodStatus: PeriodStatus): PipStatus {
  if (qCheckin?.employee_submitted_at) return 'done'
  if (periodStatus === 'closed') return 'late'
  return 'pending'
}

const ENERGY_EMOJI: Record<MoodEnergy, string> = { terrible: '😩', meh: '😐', okay: '🙂', great: '🔥' }
const PRODUCTIVITY_EMOJI: Record<MoodProductivity, string> = { waste: '🐌', fine: '👍', ludicrous: '🚀' }

function MoodPips({ checkinByPeriodMonth, periodId, months }: { checkinByPeriodMonth: Map<string, Checkin>; periodId: string; months: number[] }) {
  const hasMood = months.some((m) => {
    const c = checkinByPeriodMonth.get(`${periodId}-${m}`)
    return c?.mood_energy || c?.mood_productivity
  })

  if (!hasMood) return null

  return (
    <div className="flex items-center gap-3 mt-2">
      <span className="text-[10px] text-lr-muted uppercase tracking-wide">Pulse</span>
      <div className="flex items-center gap-2">
        {months.map((m) => {
          const c = checkinByPeriodMonth.get(`${periodId}-${m}`)
          if (!c?.mood_energy && !c?.mood_productivity) return <span key={m} className="text-[10px] text-lr-muted/30">—</span>
          return (
            <span key={m} className="inline-flex items-center gap-0.5 text-sm" title={`${MONTH_NAMES[m - 1]}: Energy ${c.mood_energy ?? '?'}, Productivity ${c.mood_productivity ?? '?'}`}>
              {c.mood_energy && <span>{ENERGY_EMOJI[c.mood_energy]}</span>}
              {c.mood_productivity && <span>{PRODUCTIVITY_EMOJI[c.mood_productivity]}</span>}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ employeeId: string }>
}) {
  const { employeeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerRaw } = await (supabase as any)
    .from('profiles').select('role').eq('id', user.id).single()
  const caller = callerRaw as Pick<Profile, 'role'> | null
  if (!caller || (caller.role !== 'MANAGER' && caller.role !== 'HR_ADMIN')) redirect('/dashboard')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subsRaw } = await (supabase as any).rpc('get_subordinates', { manager_uuid: user.id })
  const subIds = new Set(((subsRaw ?? []) as SubordinateRow[]).map((s) => s.id))
  if (!subIds.has(employeeId)) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employeeRaw } = await (supabase as any)
    .from('profiles').select('*').eq('id', employeeId).single()
  const employee = employeeRaw as Profile | null
  if (!employee) notFound()

  const [periodsResult, checkinsResult, qCheckinsResult, scoresResult, okrsResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('performance_periods').select('*')
      .order('year', { ascending: false }).order('quarter', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('checkins').select('*').eq('employee_id', employeeId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('quarterly_checkins').select('*').eq('employee_id', employeeId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('quarterly_scores').select('*').eq('employee_id', employeeId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('okrs').select('*, key_results(*, initiatives(*))').eq('employee_id', employeeId),
  ])

  const allPeriods = (periodsResult.data ?? []) as PerformancePeriod[]
  const allCheckins = (checkinsResult.data ?? []) as Checkin[]
  const allQCheckins = (qCheckinsResult.data ?? []) as QuarterlyCheckin[]
  const allScores = (scoresResult.data ?? []) as QuarterlyScore[]
  const allOkrs = (okrsResult.data ?? []) as OkrWithProgress[]

  allOkrs.forEach((o) => {
    o.key_results = [...(o.key_results ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    o.key_results.forEach((kr) => {
      kr.initiatives = [...(kr.initiatives ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    })
  })

  const checkinByPeriodMonth = new Map<string, Checkin>()
  for (const c of allCheckins) checkinByPeriodMonth.set(`${c.period_id}-${c.month}`, c)

  const qCheckinByPeriod = new Map<string, QuarterlyCheckin>()
  for (const q of allQCheckins) qCheckinByPeriod.set(q.period_id, q)

  const scoreByPeriod = new Map<string, QuarterlyScore>()
  for (const s of allScores) scoreByPeriod.set(s.period_id, s)

  const okrsByPeriod = new Map<string, OkrWithProgress[]>()
  const deletedOkrsByPeriod = new Map<string, OkrWithProgress[]>()
  for (const o of allOkrs) {
    if (o.deleted_at) {
      if (!deletedOkrsByPeriod.has(o.period_id)) deletedOkrsByPeriod.set(o.period_id, [])
      deletedOkrsByPeriod.get(o.period_id)!.push(o)
    } else {
      if (!okrsByPeriod.has(o.period_id)) okrsByPeriod.set(o.period_id, [])
      okrsByPeriod.get(o.period_id)!.push(o)
    }
  }

  const activePeriodIds = new Set([
    ...allCheckins.map((c) => c.period_id),
    ...allQCheckins.map((q) => q.period_id),
    ...allScores.map((s) => s.period_id),
    ...allOkrs.map((o) => o.period_id), // includes deleted okrs
  ])
  const periods = allPeriods.filter((p) => p.status === 'open' || activePeriodIds.has(p.id))

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentQuarter = Math.ceil(currentMonth / 3)

  // Filter out future periods (no data and hasn't started yet)
  const visiblePeriods = periods.filter((p) => {
    const isFuture = p.year > currentYear || (p.year === currentYear && p.quarter > currentQuarter)
    return !isFuture
  })

  return (
    <div className="space-y-6">
      <Link href="/team" className="inline-block text-sm text-lr-muted hover:text-lr-text transition-colors">
        ← Team
      </Link>

      {/* Employee header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14">
          <AvatarImage src={employee.avatar_url ?? undefined} />
          <AvatarFallback className="bg-lr-accent text-white text-lg">
            {getInitials(employee.full_name, employee.email)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-page-title">{employee.full_name ?? employee.email}</h1>
          <p className="text-body text-lr-muted">{employee.email}</p>
          <p className="text-caption text-lr-muted mt-1">
            Joined {format(new Date(employee.created_at), 'MMM d, yyyy')}
          </p>
        </div>
      </div>

      {periods.length === 0 && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-12 text-center">
          <p className="text-body text-lr-muted">No performance data yet.</p>
        </div>
      )}

      {/* Quarter cards — newest first */}
      {visiblePeriods.map((period) => {
        const isOpen = period.status === 'open'
        const months = quarterMonths(period.quarter)
        const qCheckin = qCheckinByPeriod.get(period.id)
        const score = scoreByPeriod.get(period.id)
        const periodOkrs = okrsByPeriod.get(period.id) ?? []
        const deletedPeriodOkrs = deletedOkrsByPeriod.get(period.id) ?? []

        // Collect all MITs from submitted check-ins in this period
        type MitEntry = { month: number; mit: ReviewMit }
        const allMitEntries: MitEntry[] = []
        for (const m of months) {
          const c = checkinByPeriodMonth.get(`${period.id}-${m}`)
          if (!c?.employee_submitted_at || !c.mits) continue
          for (const mit of (c.mits as ReviewMit[])) {
            if (mit.title?.trim()) allMitEntries.push({ month: m, mit })
          }
        }

        // Group MITs: linked to a goal vs unlinked
        const mitsByOkr = new Map<string, MitEntry[]>()
        const unlinkedMits: MitEntry[] = []
        for (const entry of allMitEntries) {
          if (entry.mit.okr_id) {
            if (!mitsByOkr.has(entry.mit.okr_id)) mitsByOkr.set(entry.mit.okr_id, [])
            mitsByOkr.get(entry.mit.okr_id)!.push(entry)
          } else {
            unlinkedMits.push(entry)
          }
        }

        // Goals from quarterly check-in (typed loosely)
        type QGoal = { id: string; title?: string; status: 'achieved' | 'not_achieved' | null }
        const qGoals = (qCheckin?.goals as QGoal[] | null | undefined) ?? []

        const showGoalSection = periodOkrs.length > 0 || allMitEntries.length > 0

        return (
          <section
            key={period.id}
            className={`rounded-[var(--radius-lr-lg)] border bg-lr-glass backdrop-blur-[8px] overflow-hidden ${
              isOpen ? 'border-lr-accent/30' : 'border-lr-border'
            }`}
          >
            {/* Period header */}
            <div className={`flex items-center justify-between gap-4 px-5 py-4 border-b ${
              isOpen ? 'bg-lr-accent-dim/20 border-lr-accent/20' : 'bg-lr-surface/40 border-lr-border'
            }`}>
              <div className="flex items-center gap-2.5">
                <h2 className="text-card-title">{period.name}</h2>
                {isOpen && (
                  <Badge variant="outline" className="text-[10px] bg-lr-accent-dim text-lr-accent border-lr-accent/20">
                    Current
                  </Badge>
                )}
              </div>

              {score ? (
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-lr-muted">PM <span className="font-bold text-lr-accent">{score.professional_mastery ?? '—'}</span></span>
                  <span className="text-xs text-lr-muted">Goals <span className="font-bold text-lr-accent">{score.okrs_stretch_goals ?? '—'}</span></span>
                  <span className="text-xs text-lr-muted">B&amp;V <span className="font-bold text-lr-accent">{score.behaviours_values ?? '—'}</span></span>
                  <Link
                    href={`/scoring/${employeeId}/${period.id}`}
                    className="shrink-0 rounded-[var(--radius-lr)] border border-lr-accent/20 bg-lr-accent-dim text-lr-accent px-3 py-1.5 text-sm font-medium hover:bg-lr-accent/20 transition-colors"
                  >
                    Score Quarter →
                  </Link>
                </div>
              ) : (
                <Link
                  href={`/scoring/${employeeId}/${period.id}`}
                  className="shrink-0 rounded-[var(--radius-lr)] border border-lr-accent/20 bg-lr-accent-dim text-lr-accent px-3 py-1.5 text-sm font-medium hover:bg-lr-accent/20 transition-colors"
                >
                  Score Quarter →
                </Link>
              )}
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* Check-in pips + quarterly link */}
              <div className="flex items-center gap-2 flex-wrap">
                {months.map((m) => {
                  const checkin = checkinByPeriodMonth.get(`${period.id}-${m}`)
                  return (
                    <Pip
                      key={m}
                      label={MONTH_NAMES[m - 1]}
                      status={monthPipStatus(checkin, m, period.status, period.year, currentYear, currentMonth)}
                    />
                  )
                })}
                <span className="w-px h-3 bg-lr-border mx-0.5" />
                <Pip
                  label={`Q${period.quarter}`}
                  status={quarterlyPipStatus(qCheckin, period.status)}
                />
                {qCheckin ? (
                  <Link
                    href={`/quarterly-checkins/${qCheckin.id}`}
                    className="text-[11px] text-lr-muted hover:text-lr-text transition-colors ml-1"
                  >
                    View quarterly →
                  </Link>
                ) : isOpen ? (
                  <span className="text-[11px] text-lr-muted/50 ml-1">Quarterly not started</span>
                ) : null}
              </div>

              <MoodPips checkinByPeriodMonth={checkinByPeriodMonth} periodId={period.id} months={months} />

              {/* Goals & MIT linked view */}
              {showGoalSection && (
                <div className="space-y-2">
                  <p className="text-section-label">Goals &amp; Work</p>

                  {periodOkrs.map((okr) => {
                    const inits = okr.key_results.flatMap((kr) => kr.initiatives)
                    const done = inits.filter((i) => i.completed).length
                    const pct = inits.length > 0 ? Math.round((done / inits.length) * 100) : 0
                    const linked = mitsByOkr.get(okr.id) ?? []
                    const qGoal = qGoals.find((g) => g.id === okr.id)

                    return (
                      <div key={okr.id} className="rounded-[var(--radius-lr)] border border-lr-border/50 bg-lr-surface/20 overflow-hidden">
                        {/* Goal header */}
                        <div className="flex items-center gap-3 px-3 py-2 bg-lr-surface/30">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-lr-accent/60" />
                          <p className="text-xs font-medium text-lr-text flex-1 min-w-0">{okr.title}</p>
                          <div className="flex items-center gap-2.5 shrink-0">
                            {qGoal?.status && (
                              <span className={`text-[10px] font-medium ${qGoal.status === 'achieved' ? 'text-lr-success' : 'text-lr-error'}`}>
                                {qGoal.status === 'achieved' ? 'Achieved' : 'Not achieved'}
                              </span>
                            )}
                            {inits.length > 0 && (
                              <span className="text-[10px] text-lr-muted">{done}/{inits.length}</span>
                            )}
                          </div>
                        </div>
                        {inits.length > 0 && (
                          <div className="h-0.5 bg-lr-surface">
                            <div className="h-full bg-lr-accent/60" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                        {linked.length > 0 ? (
                          <div className="px-3 py-2 space-y-1.5">
                            {linked.map(({ month, mit }, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className={`mt-[3px] h-1.5 w-1.5 rounded-full shrink-0 ${
                                  mit.status === 'achieved' ? 'bg-lr-success' : 'bg-lr-error/70'
                                }`} />
                                <p className="text-xs text-lr-text leading-snug flex-1">{mit.title}</p>
                                <span className="text-[10px] text-lr-muted shrink-0">{MONTH_NAMES[month - 1]}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="px-3 py-2">
                            <p className="text-[10px] text-lr-muted/40 italic">No MITs linked to this goal</p>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Unlinked MITs */}
                  {unlinkedMits.length > 0 && (
                    <div className="rounded-[var(--radius-lr)] border border-lr-border/50 bg-lr-surface/20 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-lr-surface/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-lr-muted/40 shrink-0" />
                        <p className="text-xs font-medium text-lr-muted">Other Work</p>
                      </div>
                      <div className="px-3 py-2 space-y-1.5">
                        {unlinkedMits.map(({ month, mit }, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className={`mt-[3px] h-1.5 w-1.5 rounded-full shrink-0 ${
                              mit.status === 'achieved' ? 'bg-lr-success' : 'bg-lr-error/70'
                            }`} />
                            <p className="text-xs text-lr-text leading-snug flex-1">{mit.title}</p>
                            <span className="text-[10px] text-lr-muted shrink-0">{MONTH_NAMES[month - 1]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Deleted goals log */}
              {deletedPeriodOkrs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-lr-muted/50 uppercase tracking-wider">Deleted goals</p>
                  {deletedPeriodOkrs.map((okr) => (
                    <div key={okr.id} className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-lr)] border border-lr-border/30 bg-lr-surface/10 opacity-50">
                      <span className="h-1.5 w-1.5 rounded-full bg-lr-muted/30 shrink-0" />
                      <p className="text-xs text-lr-muted line-through flex-1 min-w-0 truncate">{okr.title}</p>
                      {okr.deleted_at && (
                        <span className="text-[10px] text-lr-muted/40 shrink-0">
                          {format(new Date(okr.deleted_at), 'MMM d')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Monthly check-in links */}
              {months.some((m) => checkinByPeriodMonth.has(`${period.id}-${m}`)) && (
                <div className="space-y-1">
                  {months.map((m) => {
                    const checkin = checkinByPeriodMonth.get(`${period.id}-${m}`)
                    if (!checkin) return null
                    return (
                      <Link
                        key={m}
                        href={`/checkins/${checkin.id}`}
                        className="flex items-center justify-between rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface/30 px-3 py-2 hover:bg-lr-surface transition-colors"
                      >
                        <span className="text-xs text-lr-text">{MONTH_NAMES[m - 1]} check-in</span>
                        {checkin.employee_submitted_at ? (
                          <Badge variant="outline" className="text-[10px] bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20">Submitted</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-lr-surface text-lr-muted border-lr-border">Draft</Badge>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
