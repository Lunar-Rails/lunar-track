import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import PendingApprovals from '@/components/dashboard/PendingApprovals'
import type { Profile, SubordinateRow, PerformancePeriod, Checkin, QuarterlyScore, CompanyValue, QuarterlyCheckin, ValueSelfAssessment, ValueAssessment } from '@/lib/types/database'

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

  // Company values + usage data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: valuesRaw } = await (supabase as any).from('company_values').select('*').order('sort_order')
  const companyValues = (valuesRaw ?? []) as CompanyValue[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: myQCheckinsRaw } = await (supabase as any)
    .from('quarterly_checkins').select('value_assessments, value_self_assessments').eq('employee_id', user.id)
  const myQCheckins = (myQCheckinsRaw ?? []) as Pick<QuarterlyCheckin, 'value_assessments' | 'value_self_assessments'>[]

  const valueUsage = new Map<string, number>()
  for (const qc of myQCheckins) {
    const v2 = (qc.value_assessments as ValueAssessment[] | null) ?? []
    for (const va of v2) { if (va.value_id) valueUsage.set(va.value_id, (valueUsage.get(va.value_id) ?? 0) + 1) }
    const v1 = (qc.value_self_assessments as ValueSelfAssessment[] | null) ?? []
    for (const va of v1) { if (va.value_id) valueUsage.set(va.value_id, (valueUsage.get(va.value_id) ?? 0) + 1) }
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

      {/* Employee: What's next card */}
      {profile.role === 'EMPLOYEE' && openPeriod && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-card-title">What&apos;s next</h2>
            {daysLeft !== null && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                daysLeft <= 7
                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : daysLeft <= 14
                  ? 'bg-lr-gold-dim text-lr-gold border-lr-gold/20'
                  : 'bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20'
              }`}>
                {daysLeft > 0 ? `${daysLeft}d left in ${openPeriod.name}` : 'Period ended'}
              </span>
            )}
          </div>

          {/* Next action */}
          <div className="rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface p-4">
            {!thisMonthCheckin?.employee_submitted_at ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-lr-text">{MONTH_NAMES[currentMonth - 1]} check-in due</p>
                  <p className="text-xs text-lr-muted mt-0.5">Fill in your MITs and reflection for this month</p>
                </div>
                <Link
                  href="/checkins/new"
                  className="shrink-0 rounded-[var(--radius-lr)] bg-lr-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-lr-accent/90 transition-colors"
                >
                  Start →
                </Link>
              </div>
            ) : thisMonthCheckin.manager_submitted_at ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-lr-text">{MONTH_NAMES[currentMonth - 1]} check-in complete</p>
                  <p className="text-xs text-lr-muted mt-0.5">Your manager has reviewed your check-in</p>
                </div>
                <Link href={`/checkins/${thisMonthCheckin.id}`} className="text-xs text-lr-accent hover:underline shrink-0">View →</Link>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-lr-text">{MONTH_NAMES[currentMonth - 1]} check-in submitted</p>
                  <p className="text-xs text-lr-gold mt-0.5">Awaiting manager review</p>
                </div>
                <Link href={`/checkins/${thisMonthCheckin.id}`} className="text-xs text-lr-accent hover:underline shrink-0">View →</Link>
              </div>
            )}
          </div>

          {/* Goals summary */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-lr-muted">
              {myOkrCounts.total === 0
                ? 'No goals set this quarter'
                : `${myOkrCounts.approved} of ${myOkrCounts.total} goal${myOkrCounts.total !== 1 ? 's' : ''} approved`}
              {myOkrCounts.pending > 0 && <span className="text-lr-gold ml-1">· {myOkrCounts.pending} pending</span>}
            </span>
            <Link href="/okrs" className="text-xs text-lr-accent hover:underline">
              {myOkrCounts.total === 0 ? 'Set goals' : 'View goals'} →
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

      {/* Manager / HR Admin: pending actions */}
      {(profile.role === 'MANAGER' || profile.role === 'HR_ADMIN') && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)]">
          <h2 className="text-card-title mb-4">Pending actions</h2>
          {pendingCheckins === 0 && pendingOkrs === 0 ? (
            <p className="text-sm text-lr-cyan">All caught up — no pending reviews or approvals.</p>
          ) : (
            <div className="space-y-2">
              {pendingCheckins > 0 && (
                <Link href="/inbox">
                  <div className="flex items-center justify-between rounded-[var(--radius-lr)] border border-lr-gold/30 bg-lr-gold-dim px-3 py-2.5 hover:bg-lr-gold/10 transition-colors">
                    <span className="text-sm text-lr-gold">📋 {pendingCheckins} check-in{pendingCheckins !== 1 ? 's' : ''} to review</span>
                    <span className="text-xs text-lr-gold/70">Inbox →</span>
                  </div>
                </Link>
              )}
              {pendingOkrs > 0 && (
                <Link href="/inbox">
                  <div className="flex items-center justify-between rounded-[var(--radius-lr)] border border-lr-accent/20 bg-lr-accent-dim px-3 py-2.5 hover:bg-lr-accent/10 transition-colors">
                    <span className="text-sm text-lr-accent">🎯 {pendingOkrs} goal{pendingOkrs !== 1 ? 's' : ''} to approve</span>
                    <span className="text-xs text-lr-accent/70">Inbox →</span>
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pending team join requests */}
      {(profile.role === 'MANAGER' || profile.role === 'HR_ADMIN') && pendingRequests.length > 0 && (
        <PendingApprovals requests={pendingRequests} />
      )}

      {/* Company values — sized by personal usage */}
      {companyValues.length > 0 && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] px-6 py-7 shadow-[var(--shadow-lr-card)]">
          <p className="text-kicker mb-5">Our Values</p>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            {(() => {
              const sorted = [...companyValues].sort((a, b) => (valueUsage.get(b.id) ?? 0) - (valueUsage.get(a.id) ?? 0))
              const maxUse = Math.max(1, ...companyValues.map((v) => valueUsage.get(v.id) ?? 0))
              const SIZE = ['text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl'] as const
              const COLOR = [
                'text-lr-muted/50',
                'text-lr-muted',
                'text-lr-text/70',
                'text-lr-cyan',
                'text-lr-accent',
              ] as const
              return sorted.map((v, i) => {
                const use = valueUsage.get(v.id) ?? 0
                // rank 0 = most used; scale size + color by usage
                const rank = maxUse === 0 ? (4 - i) : Math.min(4, Math.round((use / maxUse) * 4))
                return (
                  <span
                    key={v.id}
                    title={v.description}
                    className={`font-bold leading-tight transition-colors cursor-default select-none ${SIZE[rank]} ${COLOR[rank]}`}
                  >
                    {v.name}
                  </span>
                )
              })
            })()}
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
