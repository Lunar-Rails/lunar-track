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

  // Fetch latest check-in status per direct report for current month
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const checkinStatuses: Record<string, { employee_submitted_at: string | null; manager_submitted_at: string | null }> = {}
  const quarterlyStatuses: Record<string, { employee_submitted_at: string | null; manager_submitted_at: string | null }> = {}

  // Open period (for quarterly check-in scoping)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: openPeriodRaw } = await (supabase as any)
    .from('performance_periods').select('id').eq('status', 'open').limit(1).maybeSingle()
  const openPeriodId = (openPeriodRaw as { id: string } | null)?.id ?? null

  if (directReports.length > 0) {
    const reportIds = directReports.map((r) => r.id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: checkinsRaw } = await (supabase as any)
      .from('checkins')
      .select('employee_id, employee_submitted_at, manager_submitted_at')
      .in('employee_id', reportIds)
      .eq('month', month)
      .eq('year', year)

    for (const c of (checkinsRaw ?? []) as { employee_id: string; employee_submitted_at: string | null; manager_submitted_at: string | null }[]) {
      checkinStatuses[c.employee_id] = c
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
  }

  function badgeFor(status: { employee_submitted_at: string | null; manager_submitted_at: string | null } | undefined, label: string) {
    const employeeSubmitted = !!status?.employee_submitted_at
    const managerSubmitted = !!status?.manager_submitted_at
    if (managerSubmitted) return { cls: 'bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20', text: `${label}: Done` }
    if (employeeSubmitted) return { cls: 'bg-lr-gold-dim text-lr-gold border-lr-gold/20', text: `${label}: Review` }
    return { cls: 'bg-lr-surface text-lr-muted border-lr-border', text: `${label}: Not started` }
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
            const monthly = badgeFor(checkinStatuses[report.id], 'Monthly')
            const quarterly = badgeFor(quarterlyStatuses[report.id], 'Quarterly')

            return (
              <Link key={report.id} href={`/team/${report.id}`}>
                <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-4 hover:bg-lr-surface transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={report.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-lr-accent text-white text-sm">
                        {getInitials(report.full_name, report.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-lr-text truncate">
                        {report.full_name ?? report.email}
                      </p>
                      <p className="text-xs text-lr-muted truncate">{report.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <Badge variant="outline" className={`text-xs ${ROLE_BADGE[report.role] ?? ''}`}>
                        {report.role}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${monthly.cls}`}>
                        {monthly.text}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${quarterly.cls}`}>
                        {quarterly.text}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
