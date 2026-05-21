import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import PendingApprovals from '@/components/dashboard/PendingApprovals'
import type { Profile, SubordinateRow, PerformancePeriod, Checkin, QuarterlyScore } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const ROLE_BADGE: Record<string, string> = {
  HR_ADMIN: 'bg-lr-accent-dim text-lr-accent border-lr-accent/20',
  MANAGER: 'bg-lr-gold-dim text-lr-gold border-lr-gold/20',
  EMPLOYEE: 'bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20',
}

function daysUntil(dateStr: string): number {
  const end = new Date(dateStr)
  const now = new Date()
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const profile = profileRaw as Profile | null
  if (!profile) redirect('/login')

  // Fetch manager name if assigned
  let managerName: string | null = null
  if (profile.manager_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: manager } = await (supabase as any)
      .from('profiles')
      .select('full_name, email')
      .eq('id', profile.manager_id)
      .single()
    const m = manager as Pick<Profile, 'full_name' | 'email'> | null
    managerName = m?.full_name ?? m?.email ?? null
  }

  // Fetch open period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: openPeriodRaw } = await (supabase as any)
    .from('performance_periods').select('*').eq('status', 'open').limit(1).maybeSingle()
  const openPeriod = openPeriodRaw as PerformancePeriod | null

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  // Employee-specific data
  let thisMonthCheckin: Checkin | null = null
  let myOkrCounts = { total: 0, approved: 0, pending: 0 }
  let latestScore: QuarterlyScore | null = null
  let hasNewScore = false

  if (profile.role === 'EMPLOYEE' && openPeriod) {
    // Current month check-in
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: checkinRaw } = await (supabase as any)
      .from('checkins')
      .select('*')
      .eq('employee_id', user.id)
      .eq('period_id', openPeriod.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()
    thisMonthCheckin = checkinRaw as Checkin | null

    // OKR counts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: okrsRaw } = await (supabase as any)
      .from('okrs')
      .select('status')
      .eq('employee_id', user.id)
      .eq('period_id', openPeriod.id)
    const okrs = (okrsRaw ?? []) as { status: string }[]
    myOkrCounts = {
      total: okrs.length,
      approved: okrs.filter((o) => o.status === 'APPROVED').length,
      pending: okrs.filter((o) => o.status === 'PENDING_REVIEW').length,
    }
  }

  // Latest visible score (any period)
  if (profile.role === 'EMPLOYEE') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: scoreRaw } = await (supabase as any)
      .from('quarterly_scores')
      .select('*')
      .eq('employee_id', user.id)
      .eq('visible_to_employee', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    latestScore = scoreRaw as QuarterlyScore | null
    hasNewScore = !!latestScore
  }

  // For managers/HR: direct reports + pending items
  let directReports: SubordinateRow[] = []
  let pendingRequests: { id: string; email: string; full_name: string | null; created_at: string }[] = []
  let pendingCheckins = 0
  let pendingOkrs = 0
  let teamCheckinDone = 0

  if (profile.role === 'MANAGER' || profile.role === 'HR_ADMIN') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: subs } = await (supabase as any).rpc('get_subordinates', {
      manager_uuid: profile.id,
    })
    directReports = ((subs ?? []) as SubordinateRow[]).filter((s) => s.depth === 1)

    // Pending join requests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingQuery = (supabase as any)
      .from('profiles')
      .select('id, email, full_name, created_at')
      .not('pending_manager_id', 'is', null)
    if (profile.role === 'MANAGER') {
      pendingQuery.eq('pending_manager_id', profile.id)
    }
    const { data: pendingRaw } = await pendingQuery
    pendingRequests = pendingRaw ?? []

    // Pending check-ins and OKRs this month
    if (directReports.length > 0) {
      const reportIds = directReports.map((r) => r.id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: checkinsRaw } = await (supabase as any)
        .from('checkins')
        .select('employee_submitted_at, manager_submitted_at')
        .in('employee_id', reportIds)
        .eq('month', currentMonth)
        .eq('year', currentYear)

      const checkins = (checkinsRaw ?? []) as { employee_submitted_at: string | null; manager_submitted_at: string | null }[]
      pendingCheckins = checkins.filter((c) => c.employee_submitted_at && !c.manager_submitted_at).length
      teamCheckinDone = checkins.filter((c) => !!c.manager_submitted_at).length

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: okrCountRaw } = await (supabase as any).rpc('get_pending_okr_count', { manager_uuid: profile.id })
      pendingOkrs = (okrCountRaw as number) ?? 0
    }
  }

  const daysLeft = openPeriod ? daysUntil(openPeriod.end_date) : null

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-kicker">Welcome back</p>
          <h1 className="text-page-title mt-1">
            {profile.full_name?.split(' ')[0] ?? profile.email}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className={ROLE_BADGE[profile.role] ?? ''}>
              {profile.role.replace('_', ' ')}
            </Badge>
            {managerName && (
              <span className="text-xs text-lr-muted">· Reports to {managerName}</span>
            )}
          </div>
        </div>

        {/* Period pill */}
        {openPeriod && (
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-accent/20 bg-lr-accent-dim px-4 py-3 text-right shrink-0">
            <p className="text-xs font-semibold text-lr-accent">{openPeriod.name}</p>
            <p className="text-xs text-lr-muted mt-0.5">
              {formatDate(openPeriod.start_date)} – {formatDate(openPeriod.end_date)}
            </p>
            {daysLeft !== null && (
              <p className={`text-xs font-medium mt-0.5 ${daysLeft <= 7 ? 'text-lr-error' : daysLeft <= 14 ? 'text-lr-gold' : 'text-lr-cyan'}`}>
                {daysLeft > 0 ? `${daysLeft}d remaining` : 'Period ended'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* No-manager warning for employees */}
      {profile.role === 'EMPLOYEE' && !managerName && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-gold/30 bg-lr-gold-dim px-5 py-4 text-sm text-lr-gold flex items-center gap-3">
          <span className="text-base">⚠️</span>
          <span>You don&apos;t have a manager assigned yet. Contact your HR Admin to get set up.</span>
        </div>
      )}

      {/* Employee: Cycle status card */}
      {profile.role === 'EMPLOYEE' && openPeriod && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 shadow-[var(--shadow-lr-card)]">
          <h2 className="text-card-title mb-5">Quarter Progress</h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Check-in this month */}
            <div className="rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface p-4 space-y-2">
              <p className="text-caption">{MONTH_NAMES[currentMonth - 1]} Check-in</p>
              {thisMonthCheckin?.manager_submitted_at ? (
                <div>
                  <p className="text-2xl">✓</p>
                  <p className="text-xs text-lr-cyan font-medium">Complete</p>
                </div>
              ) : thisMonthCheckin?.employee_submitted_at ? (
                <div>
                  <p className="text-2xl">⏳</p>
                  <p className="text-xs text-lr-gold font-medium">Awaiting manager</p>
                </div>
              ) : (
                <div>
                  <p className="text-2xl">○</p>
                  <p className="text-xs text-lr-muted">Not started</p>
                </div>
              )}
              <Link
                href={thisMonthCheckin ? `/checkins/${thisMonthCheckin.id}` : '/checkins/new'}
                className="block text-xs text-lr-accent hover:underline"
              >
                {thisMonthCheckin ? 'View check-in' : 'Start check-in'} →
              </Link>
            </div>

            {/* OKRs */}
            <div className="rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface p-4 space-y-2">
              <p className="text-caption">Goals</p>
              {myOkrCounts.total === 0 ? (
                <div>
                  <p className="text-2xl">○</p>
                  <p className="text-xs text-lr-muted">None set</p>
                </div>
              ) : (
                <div>
                  <p className="text-2xl font-bold text-lr-text">{myOkrCounts.approved}<span className="text-sm text-lr-muted">/{myOkrCounts.total}</span></p>
                  <p className="text-xs text-lr-muted">approved</p>
                  {myOkrCounts.pending > 0 && (
                    <p className="text-xs text-lr-gold">{myOkrCounts.pending} pending</p>
                  )}
                </div>
              )}
              <Link href="/okrs" className="block text-xs text-lr-accent hover:underline">
                {myOkrCounts.total === 0 ? 'Set Goals' : 'View Goals'} →
              </Link>
            </div>

          </div>

          {/* Quick actions */}
          <div className="mt-5 pt-5 border-t border-lr-border flex gap-3 flex-wrap">
            {!thisMonthCheckin?.employee_submitted_at && (
              <Link href="/checkins/new" className="rounded-[var(--radius-lr)] border border-lr-accent bg-lr-accent px-4 py-2 text-sm text-white hover:bg-lr-accent/90 transition-colors font-medium">
                Start check-in
              </Link>
            )}
            <Link href="/okrs/new" className="rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface px-4 py-2 text-sm text-lr-text hover:bg-lr-surface-2 transition-colors">
              New Goal
            </Link>
            <Link href="/okrs" className="rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface px-4 py-2 text-sm text-lr-text hover:bg-lr-surface-2 transition-colors">
              My Goals
            </Link>
          </div>
        </div>
      )}

      {/* Employee: no open period */}
      {profile.role === 'EMPLOYEE' && !openPeriod && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 shadow-[var(--shadow-lr-card)]">
          <h2 className="text-card-title mb-2">No active period</h2>
          <p className="text-body text-lr-muted">No performance period is open right now. Check back later or contact your HR Admin.</p>
        </div>
      )}

      {/* Manager / HR Admin: inbox summary */}
      {(profile.role === 'MANAGER' || profile.role === 'HR_ADMIN') && (pendingCheckins > 0 || pendingOkrs > 0) && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-gold/30 bg-lr-gold-dim p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-lr-gold mb-1">Action needed</h2>
              <div className="flex gap-4 text-sm text-lr-gold/80">
                {pendingCheckins > 0 && (
                  <span>📋 {pendingCheckins} check-in{pendingCheckins !== 1 ? 's' : ''} to review</span>
                )}
                {pendingOkrs > 0 && (
                  <span>🎯 {pendingOkrs} Goal{pendingOkrs !== 1 ? 's' : ''} to approve</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {pendingCheckins > 0 && (
                <Link href="/inbox" className="rounded-[var(--radius-lr)] border border-lr-gold/40 bg-lr-gold/10 px-3 py-1.5 text-xs text-lr-gold hover:bg-lr-gold/20 transition-colors font-medium">
                  Inbox →
                </Link>
              )}
              {pendingOkrs > 0 && (
                <Link href="/inbox" className="rounded-[var(--radius-lr)] border border-lr-gold/40 bg-lr-gold/10 px-3 py-1.5 text-xs text-lr-gold hover:bg-lr-gold/20 transition-colors font-medium">
                  Goals to approve →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pending team join requests */}
      {(profile.role === 'MANAGER' || profile.role === 'HR_ADMIN') && pendingRequests.length > 0 && (
        <PendingApprovals requests={pendingRequests} />
      )}

      {/* Manager / HR: Team health card */}
      {(profile.role === 'MANAGER' || profile.role === 'HR_ADMIN') && directReports.length > 0 && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 shadow-[var(--shadow-lr-card)]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-card-title">Team · {MONTH_NAMES[currentMonth - 1]}</h2>
              <p className="text-xs text-lr-muted mt-0.5">{directReports.length} direct report{directReports.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-lr-text">{teamCheckinDone}<span className="text-lg text-lr-muted">/{directReports.length}</span></p>
              <p className="text-xs text-lr-muted">check-ins done</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-lr-surface rounded-full overflow-hidden mb-5">
            <div
              className="h-full bg-lr-cyan rounded-full transition-all"
              style={{ width: `${directReports.length > 0 ? (teamCheckinDone / directReports.length) * 100 : 0}%` }}
            />
          </div>

          <ul className="space-y-2">
            {directReports.map((report) => (
              <li key={report.id} className="flex items-center gap-3">
                <Link href={`/team/${report.id}`} className="text-sm text-lr-text hover:text-lr-accent hover:underline transition-colors flex-1">
                  {report.full_name ?? report.email}
                </Link>
                <Badge
                  variant="outline"
                  className={`text-xs ${ROLE_BADGE[report.role] ?? ''}`}
                >
                  {report.role}
                </Badge>
              </li>
            ))}
          </ul>

          <div className="mt-4 pt-4 border-t border-lr-border">
            <Link href="/team" className="text-sm text-lr-accent hover:underline">
              Full team view →
            </Link>
          </div>
        </div>
      )}

      {/* HR Admin quick links */}
      {profile.role === 'HR_ADMIN' && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 shadow-[var(--shadow-lr-card)]">
          <h2 className="text-card-title mb-4">Administration</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/admin/users', label: 'Manage Users', desc: 'Roles, managers, onboarding', icon: '👤' },
              { href: '/admin/org', label: 'Org Chart', desc: 'Reporting hierarchy', icon: '🌐' },
              { href: '/admin/periods', label: 'Performance Periods', desc: 'Open, close, manage quarters', icon: '📅' },
              { href: '/admin/scores', label: 'Score Calibration', desc: 'Review & calibrate ratings', icon: '📊' },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface px-4 py-3 hover:bg-lr-surface-2 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span>{link.icon}</span>
                  <span className="text-sm font-medium text-lr-text group-hover:text-lr-accent transition-colors">{link.label}</span>
                </div>
                <p className="text-xs text-lr-muted">{link.desc}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Profile card — collapsed at bottom */}
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)]">
        <h2 className="text-card-title mb-3">Profile</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-caption w-16 shrink-0">Name</span>
            <span className="text-lr-text">{profile.full_name ?? '—'}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-caption w-16 shrink-0">Email</span>
            <span className="text-lr-text truncate">{profile.email}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-caption w-16 shrink-0">Role</span>
            <Badge variant="outline" className={`text-xs ${ROLE_BADGE[profile.role] ?? ''}`}>
              {profile.role.replace('_', ' ')}
            </Badge>
          </div>
          <div className="flex gap-2">
            <span className="text-caption w-16 shrink-0">Manager</span>
            <span className="text-lr-text">{managerName ?? 'Not assigned'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
