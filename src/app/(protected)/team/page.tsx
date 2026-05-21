import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { Profile, SubordinateRow } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

function getInitials(name: string | null, email: string): string {
  if (name) return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

const ROLE_BADGE: Record<string, string> = {
  MANAGER: 'bg-lr-gold-dim text-lr-gold border-lr-gold/20',
  EMPLOYEE: 'bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20',
  HR_ADMIN: 'bg-lr-accent-dim text-lr-accent border-lr-accent/20',
}

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

type PipStatus = 'done' | 'late' | 'pending' | 'future'

function Pip({ label, status }: { label: string; status: PipStatus }) {
  const cls =
    status === 'done'
      ? 'bg-green-500/15 text-green-400 border-green-500/25'
      : status === 'late'
      ? 'bg-red-500/10 text-red-400 border-red-500/20'
      : status === 'future'
      ? 'bg-lr-surface/40 text-lr-muted/40 border-lr-border/30'
      : 'bg-lr-surface text-lr-muted border-lr-border'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${cls}`}>
      {label}
    </span>
  )
}

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as Pick<Profile, 'role'> | null
  if (!profile || (profile.role !== 'MANAGER' && profile.role !== 'HR_ADMIN')) {
    redirect('/dashboard')
  }

  // Get direct reports (depth=1) via closure table RPC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subsRaw } = await (supabase as any).rpc('get_subordinates', { manager_uuid: user.id })
  const directReports = ((subsRaw ?? []) as SubordinateRow[]).filter((s) => s.depth === 1)

  // Get pending OKR count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingOkrCount } = await (supabase as any).rpc('get_pending_okr_count', { manager_uuid: user.id })

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const currentQuarter = Math.ceil(month / 3)
  const quarterStartMonth = (currentQuarter - 1) * 3 + 1
  const quarterMonths = [0, 1, 2].map((i) => ({
    month: quarterStartMonth + i,
    label: MONTH_ABBR[quarterStartMonth + i - 1],
  }))

  // checkinMap[employeeId][month] = { employee_submitted_at, manager_submitted_at }
  const checkinMap: Record<string, Record<number, { employee_submitted_at: string | null; manager_submitted_at: string | null }>> = {}
  const quarterlyStatuses: Record<string, { employee_submitted_at: string | null; manager_submitted_at: string | null }> = {}

  // Open period (for quarterly check-in scoping)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: openPeriodRaw } = await (supabase as any)
    .from('performance_periods').select('id, name').eq('status', 'open').limit(1).maybeSingle()
  const openPeriod = openPeriodRaw as { id: string; name: string } | null
  const openPeriodId = openPeriod?.id ?? null

  type QScore = {
    employee_id: string
    period_id: string
    professional_mastery: number | null
    okrs_stretch_goals: number | null
    behaviours_values: number | null
  }

  function scoringStatus(score: QScore | undefined): 'scored' | 'partial' | 'none' {
    if (!score) return 'none'
    if (score.professional_mastery && score.okrs_stretch_goals && score.behaviours_values) return 'scored'
    return 'partial'
  }

  const scoresMap: Record<string, QScore> = {}

  if (directReports.length > 0) {
    const reportIds = directReports.map((r) => r.id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: checkinsRaw } = await (supabase as any)
      .from('checkins')
      .select('employee_id, month, employee_submitted_at, manager_submitted_at')
      .in('employee_id', reportIds)
      .in('month', quarterMonths.map((m) => m.month))
      .eq('year', year)

    for (const c of (checkinsRaw ?? []) as { employee_id: string; month: number; employee_submitted_at: string | null; manager_submitted_at: string | null }[]) {
      if (!checkinMap[c.employee_id]) checkinMap[c.employee_id] = {}
      checkinMap[c.employee_id][c.month] = c
    }

    if (openPeriodId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: qcheckinsRaw } = await (supabase as any)
        .from('quarterly_checkins')
        .select('employee_id, employee_submitted_at, manager_submitted_at')
        .in('employee_id', reportIds)
        .eq('period_id', openPeriodId)

      for (const q of (qcheckinsRaw ?? []) as { employee_id: string; employee_submitted_at: string | null; manager_submitted_at: string | null }[]) {
        quarterlyStatuses[q.employee_id] = q
      }
    }

    if (openPeriodId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: scoresRaw } = await (supabase as any)
        .from('quarterly_scores')
        .select('employee_id, period_id, professional_mastery, okrs_stretch_goals, behaviours_values')
        .in('employee_id', reportIds)
        .eq('period_id', openPeriodId)
      for (const s of (scoresRaw ?? []) as QScore[]) {
        scoresMap[s.employee_id] = s
      }
    }
  }

  function monthPipStatus(checkin: { employee_submitted_at: string | null } | undefined, m: number): PipStatus {
    if (m > month) return 'future'
    if (checkin?.employee_submitted_at) return 'done'
    if (m < month) return 'late'
    return 'pending'
  }

  function quarterlyPipStatus(status: { employee_submitted_at: string | null } | undefined): PipStatus {
    if (status?.employee_submitted_at) return 'done'
    return 'pending'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-page-title">My Team</h1>
          <p className="text-body text-lr-muted mt-1">
            {directReports.length} direct report{directReports.length !== 1 ? 's' : ''}
            {(pendingOkrCount as number) > 0 && (
              <span className="ml-3 text-lr-gold">
                · {pendingOkrCount} Goal{(pendingOkrCount as number) !== 1 ? 's' : ''} pending review
              </span>
            )}
          </p>
        </div>
      </div>

      {directReports.length === 0 ? (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-12 text-center">
          <p className="text-body text-lr-muted">No direct reports assigned yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {directReports.map((report) => {
            const reportCheckins = checkinMap[report.id] ?? {}
            const qStatus = quarterlyPipStatus(quarterlyStatuses[report.id])

            return (
              <Link key={report.id} href={`/team/${report.id}`}>
                <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] px-4 py-3 hover:bg-lr-surface transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={report.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-lr-accent text-white text-sm">
                        {getInitials(report.full_name, report.email)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-lr-text truncate">
                          {report.full_name ?? report.email}
                        </p>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${ROLE_BADGE[report.role] ?? ''}`}>
                          {report.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-lr-muted truncate">{report.email}</p>
                    </div>

                    {/* Check-in pips */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {quarterMonths.map(({ month: m, label }) => (
                        <Pip
                          key={m}
                          label={label}
                          status={monthPipStatus(reportCheckins[m], m)}
                        />
                      ))}
                      <span className="w-px h-3 bg-lr-border mx-0.5" />
                      <Pip label={`Q${currentQuarter}`} status={qStatus} />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Quarterly Scoring Hub */}
      <div className="space-y-4 mt-8">
        {!openPeriod ? (
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 text-center">
            <p className="text-sm text-lr-muted">No open period — quarterly scoring is not available.</p>
          </div>
        ) : (
          <>
            <h2 className="text-card-title">Quarterly Scoring — {openPeriod.name}</h2>
            {directReports.length === 0 ? (
              <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 text-center">
                <p className="text-sm text-lr-muted">No direct reports assigned yet.</p>
              </div>
            ) : (
              <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-lr-border">
                      <th className="text-left px-4 py-3 text-lr-muted font-medium">Employee</th>
                      <th className="text-left px-4 py-3 text-lr-muted font-medium">Status</th>
                      <th className="text-left px-4 py-3 text-lr-muted font-medium">PM / Goals / B&amp;V</th>
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
                              className="text-xs font-medium text-lr-accent hover:text-lr-accent/80 transition-colors"
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
    </div>
  )
}
