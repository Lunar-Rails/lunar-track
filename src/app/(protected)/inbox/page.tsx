import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import type { Profile, SubordinateRow, PerformancePeriod } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

type PendingCheckin = {
  id: string
  employee_id: string
  employee_name: string
  employee_email: string
  month: number
  year: number
  employee_submitted_at: string
  period_name: string
}

type PendingOkr = {
  id: string
  employee_id: string
  employee_name: string
  employee_email: string
  title: string
  period_name: string
  created_at: string
}

type PendingQuarterlyCheckin = {
  id: string
  employee_id: string
  employee_name: string
  employee_email: string
  period_name: string
  period_quarter: number
  period_year: number
  employee_submitted_at: string
}

type UnscoredEmployee = {
  id: string
  full_name: string | null
  email: string
  period_id: string
  period_name: string
}

export default async function InboxPage() {
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

  // Get all subordinates (direct reports for manager, all employees for HR)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subsRaw } = await (supabase as any).rpc('get_subordinates', { manager_uuid: user.id })
  const directReports = ((subsRaw ?? []) as SubordinateRow[]).filter((s) => s.depth === 1)
  const reportIds = directReports.map((r) => r.id)

  // Open period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: openPeriodRaw } = await (supabase as any)
    .from('performance_periods').select('*').eq('status', 'open').limit(1).maybeSingle()
  const openPeriod = openPeriodRaw as PerformancePeriod | null

  let pendingCheckins: PendingCheckin[] = []
  let pendingOkrs: PendingOkr[] = []
  let pendingQuarterlyCheckins: PendingQuarterlyCheckin[] = []
  let unscoredEmployees: UnscoredEmployee[] = []

  if (reportIds.length > 0) {
    // Pending check-ins (employee submitted, manager has not reviewed) — all time
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: checkinsRaw } = await (supabase as any)
      .from('checkins')
      .select('id, employee_id, month, year, employee_submitted_at, period:performance_periods!period_id(name)')
      .in('employee_id', reportIds)
      .not('employee_submitted_at', 'is', null)
      .is('manager_submitted_at', null)
      .order('employee_submitted_at', { ascending: false })

    const employeeMap: Record<string, { name: string; email: string }> = {}
    for (const r of directReports) {
      employeeMap[r.id] = { name: r.full_name ?? r.email, email: r.email }
    }

    pendingCheckins = ((checkinsRaw ?? []) as {
      id: string; employee_id: string; month: number; year: number
      employee_submitted_at: string; period: { name: string }
    }[]).map((c) => ({
      id: c.id,
      employee_id: c.employee_id,
      employee_name: employeeMap[c.employee_id]?.name ?? c.employee_id,
      employee_email: employeeMap[c.employee_id]?.email ?? '',
      month: c.month,
      year: c.year,
      employee_submitted_at: c.employee_submitted_at,
      period_name: c.period?.name ?? '',
    }))

    // Pending quarterly check-ins (employee submitted, manager not yet reviewed)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: qCheckinsRaw } = await (supabase as any)
      .from('quarterly_checkins')
      .select('id, employee_id, employee_submitted_at, period:performance_periods!period_id(name,quarter,year)')
      .in('employee_id', reportIds)
      .not('employee_submitted_at', 'is', null)
      .is('manager_submitted_at', null)
      .order('employee_submitted_at', { ascending: false })

    pendingQuarterlyCheckins = ((qCheckinsRaw ?? []) as {
      id: string; employee_id: string; employee_submitted_at: string
      period: { name: string; quarter: number; year: number } | null
    }[]).map((c) => ({
      id: c.id,
      employee_id: c.employee_id,
      employee_name: employeeMap[c.employee_id]?.name ?? c.employee_id,
      employee_email: employeeMap[c.employee_id]?.email ?? '',
      period_name: c.period?.name ?? '',
      period_quarter: c.period?.quarter ?? 0,
      period_year: c.period?.year ?? 0,
      employee_submitted_at: c.employee_submitted_at,
    }))

    // Pending OKRs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: okrsRaw } = await (supabase as any)
      .from('okrs')
      .select('id, employee_id, title, created_at, period:performance_periods!period_id(name)')
      .in('employee_id', reportIds)
      .eq('status', 'PENDING_REVIEW')
      .order('created_at', { ascending: false })

    pendingOkrs = ((okrsRaw ?? []) as {
      id: string; employee_id: string; title: string; created_at: string; period: { name: string }
    }[]).map((o) => ({
      id: o.id,
      employee_id: o.employee_id,
      employee_name: employeeMap[o.employee_id]?.name ?? o.employee_id,
      employee_email: employeeMap[o.employee_id]?.email ?? '',
      title: o.title,
      period_name: o.period?.name ?? '',
      created_at: o.created_at,
    }))

    // Employees not yet scored for the open period
    if (openPeriod) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: scoredRaw } = await (supabase as any)
        .from('quarterly_scores')
        .select('employee_id')
        .in('employee_id', reportIds)
        .eq('period_id', openPeriod.id)

      const scoredIds = new Set(((scoredRaw ?? []) as { employee_id: string }[]).map((s) => s.employee_id))
      unscoredEmployees = directReports
        .filter((r) => !scoredIds.has(r.id))
        .map((r) => ({
          id: r.id,
          full_name: r.full_name,
          email: r.email,
          period_id: openPeriod.id,
          period_name: openPeriod.name,
        }))
    }
  }

  const totalItems = pendingCheckins.length + pendingOkrs.length + pendingQuarterlyCheckins.length

  function urgencyGroup(submittedAt: string): 'overdue' | 'this-week' {
    const days = Math.floor((Date.now() - new Date(submittedAt).getTime()) / 86400000)
    return days > 7 ? 'overdue' : 'this-week'
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return 'just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">Inbox</h1>
        <p className="text-body text-lr-muted mt-1">
          {totalItems === 0 ? 'All caught up 🎉' : `${totalItems} item${totalItems !== 1 ? 's' : ''} need your attention`}
        </p>
      </div>

      {/* All clear state */}
      {totalItems === 0 && unscoredEmployees.length === 0 && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-12 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-card-title text-lr-text">All caught up</p>
          <p className="text-sm text-lr-muted mt-1">No pending check-ins, Goals, or scoring items.</p>
        </div>
      )}

      {/* Pending check-ins */}
      {pendingCheckins.length > 0 && (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-card-title flex items-center gap-2">
            Check-ins to review
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-lr-gold text-[10px] font-bold text-black">
              {pendingCheckins.length}
            </span>
          </h2>
        </div>

        <div className="space-y-4">
          {(['overdue', 'this-week'] as const)
            .map((group) => ({
              group,
              label: group === 'overdue' ? 'Overdue (>7 days)' : 'This week',
              accent: group === 'overdue' ? 'border-red-500/30 bg-red-500/5' : 'border-lr-gold/30 bg-lr-glass',
              badge: group === 'overdue' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-lr-gold-dim text-lr-gold border-lr-gold/20',
              badgeText: group === 'overdue' ? 'Overdue' : 'Awaiting review',
              items: pendingCheckins.filter((c) => urgencyGroup(c.employee_submitted_at) === group),
            }))
            .filter(({ items }) => items.length > 0)
            .map(({ group, label, accent, badge, badgeText, items }) => (
              <div key={group}>
                <p className="text-[11px] font-semibold text-lr-muted uppercase tracking-wide mb-2">{label}</p>
                <div className="space-y-2">
                  {items.map((c) => (
                    <Link key={c.id} href={`/checkins/${c.id}`}>
                      <div className={`rounded-[var(--radius-lr-lg)] border backdrop-blur-[8px] p-4 hover:bg-lr-surface transition-colors cursor-pointer ${accent}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-lr-text">{c.employee_name}</p>
                            <p className="text-xs text-lr-muted">{c.employee_email}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className={`text-xs mb-1 ${badge}`}>{badgeText}</Badge>
                            <p className="text-xs text-lr-muted">{MONTH_NAMES[c.month - 1]} {c.year} · {c.period_name}</p>
                            <p className="text-xs text-lr-muted">{timeAgo(c.employee_submitted_at)}</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          }
        </div>
      </section>
      )}

      {/* Pending quarterly check-ins */}
      {pendingQuarterlyCheckins.length > 0 && (
        <section>
          <h2 className="text-card-title flex items-center gap-2 mb-3">
            Quarterly check-ins to review
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-lr-gold text-[10px] font-bold text-black">
              {pendingQuarterlyCheckins.length}
            </span>
          </h2>
          <div className="space-y-4">
            {(['overdue', 'this-week'] as const)
              .map((group) => ({
                group,
                label: group === 'overdue' ? 'Overdue (>7 days)' : 'This week',
                accent: group === 'overdue' ? 'border-red-500/30 bg-red-500/5' : 'border-lr-gold/30 bg-lr-glass',
                badge: group === 'overdue' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-lr-gold-dim text-lr-gold border-lr-gold/20',
                badgeText: group === 'overdue' ? 'Overdue' : 'Awaiting review',
                items: pendingQuarterlyCheckins.filter((c) => urgencyGroup(c.employee_submitted_at) === group),
              }))
              .filter(({ items }) => items.length > 0)
              .map(({ group, label, accent, badge, badgeText, items }) => (
                <div key={group}>
                  <p className="text-[11px] font-semibold text-lr-muted uppercase tracking-wide mb-2">{label}</p>
                  <div className="space-y-2">
                    {items.map((c) => (
                      <Link key={c.id} href={`/quarterly-checkins/${c.id}`}>
                        <div className={`rounded-[var(--radius-lr-lg)] border backdrop-blur-[8px] p-4 hover:bg-lr-surface transition-colors cursor-pointer ${accent}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-lr-text">{c.employee_name}</p>
                              <p className="text-xs text-lr-muted">{c.employee_email}</p>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className={`text-xs mb-1 ${badge}`}>{badgeText}</Badge>
                              <p className="text-xs text-lr-muted">Q{c.period_quarter} {c.period_year} · {c.period_name}</p>
                              <p className="text-xs text-lr-muted">{timeAgo(c.employee_submitted_at)}</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            }
          </div>
        </section>
      )}

      {/* Pending OKRs */}
      {pendingOkrs.length > 0 && (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-card-title flex items-center gap-2">
            Goals to approve
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-lr-accent text-[10px] font-bold text-white">
              {pendingOkrs.length}
            </span>
          </h2>
        </div>
        <div className="space-y-2">
          {pendingOkrs.map((o) => (
            <Link key={o.id} href={`/okrs/${o.id}`}>
              <div className="rounded-[var(--radius-lr-lg)] border border-lr-accent/20 bg-lr-glass backdrop-blur-[8px] p-4 hover:bg-lr-surface transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-lr-text">{o.title}</p>
                    <p className="text-xs text-lr-muted">{o.employee_name} · {o.period_name}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs bg-lr-accent-dim text-lr-accent border-lr-accent/20 mb-1">
                      Pending review
                    </Badge>
                    <p className="text-xs text-lr-muted">{timeAgo(o.created_at)}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
      )}

      {/* Unscored employees for current period */}
      {openPeriod && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-card-title flex items-center gap-2">
              Not yet scored — {openPeriod.name}
              {unscoredEmployees.length > 0 && (
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-lr-surface border border-lr-border text-[10px] font-bold text-lr-muted">
                  {unscoredEmployees.length}
                </span>
              )}
            </h2>
          </div>

          {unscoredEmployees.length === 0 ? (
            <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 text-center">
              <p className="text-sm text-lr-cyan">All team members scored for {openPeriod.name} ✓</p>
            </div>
          ) : (
            <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] overflow-hidden">
              <div className="divide-y divide-lr-border">
                {unscoredEmployees.map((e) => (
                  <Link key={e.id} href={`/scoring/${e.id}/${e.period_id}`}>
                    <div className="flex items-center justify-between px-4 py-3 hover:bg-lr-surface transition-colors">
                      <div>
                        <p className="text-sm text-lr-text">{e.full_name ?? e.email}</p>
                        <p className="text-xs text-lr-muted">{e.email}</p>
                      </div>
                      <span className="text-xs text-lr-accent hover:underline">Score now →</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

    </div>
  )
}
