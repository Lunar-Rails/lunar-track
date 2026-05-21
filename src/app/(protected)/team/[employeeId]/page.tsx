import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { KrStatusPill } from '@/components/okrs/OkrProgressControls'
import { format } from 'date-fns'
import type { Checkin, Initiative, KeyResult, Okr, PerformancePeriod, Profile, SubordinateRow, QuarterlyScore } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getInitials(name: string | null, email: string): string {
  if (name) return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

const OKR_STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-lr-surface text-lr-muted border-lr-border',
  PENDING_REVIEW: 'bg-lr-gold-dim text-lr-gold border-lr-gold/20',
  APPROVED: 'bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20',
  REVISION_REQUESTED: 'bg-red-500/10 text-red-400 border-red-500/20',
}

type CheckinWithPeriod = Checkin & { period: Pick<PerformancePeriod, 'id' | 'name'> }

export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ employeeId: string }>
}) {
  const { employeeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify caller is manager/HR_ADMIN
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerRaw } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const caller = callerRaw as Pick<Profile, 'role'> | null
  if (!caller || (caller.role !== 'MANAGER' && caller.role !== 'HR_ADMIN')) {
    redirect('/dashboard')
  }

  // Verify employeeId is actually a subordinate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subsRaw } = await (supabase as any).rpc('get_subordinates', { manager_uuid: user.id })
  const subIds = new Set(((subsRaw ?? []) as SubordinateRow[]).map((s) => s.id))
  if (!subIds.has(employeeId)) notFound()

  // Fetch employee profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employeeRaw } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('id', employeeId)
    .single()
  const employee = employeeRaw as Profile | null
  if (!employee) notFound()

  // Fetch employee's OKRs (all time) with KRs + initiatives for progress
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okrsRaw } = await (supabase as any)
    .from('okrs')
    .select('*, period:performance_periods!period_id(id,name,status), key_results(*, initiatives(*))')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
  type OkrWithProgress = Okr & {
    period: Pick<PerformancePeriod, 'id' | 'name'> & { status: PerformancePeriod['status'] }
    key_results: (KeyResult & { initiatives: Initiative[] })[]
  }
  const okrs = (okrsRaw ?? []) as OkrWithProgress[]
  // Sort children
  okrs.forEach((o) => {
    o.key_results = [...(o.key_results ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    o.key_results.forEach((kr) => {
      kr.initiatives = [...(kr.initiatives ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    })
  })

  // Fetch employee's submitted check-ins (manager can only see submitted ones via RLS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: checkinsRaw } = await (supabase as any)
    .from('checkins')
    .select('*, period:performance_periods!period_id(id,name)')
    .eq('employee_id', employeeId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  const checkins = (checkinsRaw ?? []) as CheckinWithPeriod[]

  // Fetch open periods for quick action links
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: openPeriodsRaw } = await (supabase as any)
    .from('performance_periods')
    .select('id, name, year, quarter')
    .eq('status', 'open')
    .order('year', { ascending: false })
    .order('quarter', { ascending: false })
  const openPeriods = (openPeriodsRaw ?? []) as Pick<PerformancePeriod, 'id' | 'name' | 'year' | 'quarter'>[]

  // Fetch existing quarterly scores for this employee
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: qscoresRaw } = await (supabase as any)
    .from('quarterly_scores')
    .select('period_id')
    .eq('employee_id', employeeId)
  const scoredPeriodIds = new Set(((qscoresRaw ?? []) as Pick<QuarterlyScore, 'period_id'>[]).map((s) => s.period_id))

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/team" className="text-sm text-lr-muted hover:text-lr-text transition-colors">
          ← Team
        </Link>
      </div>

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

      {/* Quick actions for open periods */}
      {openPeriods.length > 0 && (
        <section>
          <h2 className="text-card-title mb-3">Performance Actions</h2>
          <div className="space-y-2">
            {openPeriods.map((period) => (
              <div key={period.id} className="flex items-center justify-between gap-4 rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-3">
                <span className="text-sm text-lr-text">{period.name}</span>
                <div className="flex gap-2">
                  <Link
                    href={`/scoring/${employeeId}/${period.id}`}
                    className={`text-xs rounded-[var(--radius-lr)] border px-3 py-1.5 transition-colors ${
                      scoredPeriodIds.has(period.id)
                        ? 'border-lr-cyan/20 bg-lr-cyan-dim text-lr-cyan hover:bg-lr-cyan/20'
                        : 'border-lr-accent/20 bg-lr-accent-dim text-lr-accent hover:bg-lr-accent/20'
                    }`}
                  >
                    {scoredPeriodIds.has(period.id) ? 'Edit Score' : 'Score'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {/* Annual score link */}
          <Link
            href={`/annual-scores/${employeeId}?year=${new Date().getFullYear()}`}
            className="mt-2 inline-block text-xs text-lr-muted hover:text-lr-text transition-colors"
          >
            → Finalize {new Date().getFullYear()} Annual Score
          </Link>
        </section>
      )}

      {/* OKRs */}
      <section>
        <h2 className="text-card-title mb-4">Goals</h2>
        {okrs.length === 0 ? (
          <p className="text-body text-lr-muted">No Goals yet.</p>
        ) : (
          <div className="space-y-3">
            {okrs.map((okr) => {
              const allInitiatives = okr.key_results.flatMap((kr) => kr.initiatives)
              const total = allInitiatives.length
              const done = allInitiatives.filter((i) => i.completed).length
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              const showProgress = okr.status === 'APPROVED' && okr.period.status === 'open'
              return (
                <Link key={okr.id} href={`/okrs/${okr.id}`}>
                  <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-4 hover:bg-lr-surface transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-caption text-lr-muted">{okr.period.name}</p>
                        <p className="text-sm font-medium text-lr-text mt-0.5">{okr.title}</p>
                      </div>
                      <Badge variant="outline" className={`text-xs shrink-0 ${OKR_STATUS_BADGE[okr.status] ?? ''}`}>
                        {okr.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    {showProgress && total > 0 && (
                      <div className="mt-3 space-y-2 border-t border-lr-border pt-3">
                        <div className="flex items-center justify-between">
                          <p className="text-caption text-lr-muted">
                            {done}/{total} initiatives done
                          </p>
                          <p className="text-caption text-lr-muted">{pct}%</p>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-lr-surface">
                          <div
                            className="h-full bg-lr-accent transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {okr.key_results.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {okr.key_results.map((kr, ki) => (
                              <div key={kr.id} className="flex items-center gap-1">
                                <span className="text-xs font-mono text-lr-accent">KR{ki + 1}</span>
                                <KrStatusPill status={kr.progress_status} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Check-ins */}
      <section>
        <h2 className="text-card-title mb-4">Check-ins</h2>
        {checkins.length === 0 ? (
          <p className="text-body text-lr-muted">No submitted check-ins yet.</p>
        ) : (
          <div className="space-y-3">
            {checkins.map((checkin) => (
              <Link key={checkin.id} href={`/checkins/${checkin.id}`}>
                <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-4 hover:bg-lr-surface transition-colors cursor-pointer">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-lr-text">
                        {MONTH_NAMES[checkin.month - 1]} {checkin.year}
                      </p>
                      <p className="text-caption text-lr-muted">{checkin.period.name}</p>
                    </div>
                    {checkin.manager_submitted_at ? (
                      <Badge variant="outline" className="text-xs bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20">
                        Complete
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-lr-gold-dim text-lr-gold border-lr-gold/20">
                        Needs Review
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
