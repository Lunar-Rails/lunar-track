import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import type { Checkin, PerformancePeriod } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type CheckinWithPeriod = Checkin & { period: Pick<PerformancePeriod, 'id' | 'name' | 'status'> }

function daysUntil(dateStr: string): number {
  const end = new Date(dateStr)
  const now = new Date()
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function CheckinsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: openPeriodRaw } = await (supabase as any)
    .from('performance_periods')
    .select('id, name, start_date, end_date')
    .eq('status', 'open')
    .order('year', { ascending: false })
    .order('quarter', { ascending: false })
    .limit(1)
    .maybeSingle()
  const openPeriod = openPeriodRaw as Pick<PerformancePeriod, 'id' | 'name' | 'start_date' | 'end_date'> | null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: checkinsRaw } = await (supabase as any)
    .from('checkins')
    .select('*, period:performance_periods!period_id(id,name,status)')
    .eq('employee_id', user.id)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  const checkins = (checkinsRaw ?? []) as CheckinWithPeriod[]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-page-title">Monthly Check-ins</h1>
          <p className="text-body text-lr-muted mt-1">Your monthly performance check-ins</p>
        </div>
        {openPeriod && (
          <div className="flex flex-col items-end gap-2">
            <Link href={`/checkins/new?periodId=${openPeriod.id}`}>
              <Button className="bg-lr-accent hover:bg-lr-accent/90 text-white text-sm">
                New Check-in
              </Button>
            </Link>
            <div className="text-right">
              <p className="text-xs font-medium text-lr-accent">{openPeriod.name}</p>
              <p className="text-xs text-lr-muted">
                {format(new Date(openPeriod.start_date), 'MMM d')} – {format(new Date(openPeriod.end_date), 'MMM d, yyyy')}
              </p>
              {(() => {
                const d = daysUntil(openPeriod.end_date)
                return d > 0 ? (
                  <p className={`text-xs font-medium ${d <= 7 ? 'text-lr-error' : d <= 14 ? 'text-lr-gold' : 'text-lr-cyan'}`}>
                    {d}d remaining
                  </p>
                ) : null
              })()}
            </div>
          </div>
        )}
      </div>

      {checkins.length === 0 ? (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-12 text-center">
          <p className="text-body text-lr-muted">No check-ins yet.</p>
          {openPeriod && (
            <p className="text-sm text-lr-muted mt-2">
              Start your first check-in for {openPeriod.name}.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {checkins.map((checkin) => {
            const employeeSubmitted = !!checkin.employee_submitted_at
            const managerSubmitted = !!checkin.manager_submitted_at

            return (
              <Link key={checkin.id} href={`/checkins/${checkin.id}`}>
                <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-4 hover:bg-lr-surface transition-colors cursor-pointer">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-lr-text">
                        {MONTH_NAMES[checkin.month - 1]} {checkin.year}
                      </p>
                      <p className="text-caption text-lr-muted mt-0.5">{checkin.period.name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {managerSubmitted ? (
                        <Badge variant="outline" className="text-xs bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20">
                          Complete
                        </Badge>
                      ) : employeeSubmitted ? (
                        <Badge variant="outline" className="text-xs bg-lr-gold-dim text-lr-gold border-lr-gold/20">
                          Awaiting Manager
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-lr-surface text-lr-muted border-lr-border">
                          Draft
                        </Badge>
                      )}
                      {checkin.employee_submitted_at && (
                        <span className="text-xs text-lr-muted hidden sm:block">
                          Submitted {format(new Date(checkin.employee_submitted_at), 'MMM d')}
                        </span>
                      )}
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
