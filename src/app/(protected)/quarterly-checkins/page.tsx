import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import type { PerformancePeriod, QuarterlyCheckin } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

type QuarterlyCheckinWithPeriod = QuarterlyCheckin & {
  period: Pick<PerformancePeriod, 'id' | 'name' | 'status' | 'quarter' | 'year'>
}

export default async function QuarterlyCheckinsPage() {
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
  const { data: quarterlyRaw } = await (supabase as any)
    .from('quarterly_checkins')
    .select('*, period:performance_periods!period_id(id,name,status,quarter,year)')
    .eq('employee_id', user.id)
    .order('created_at', { ascending: false })
  const quarterlyCheckins = (quarterlyRaw ?? []) as QuarterlyCheckinWithPeriod[]

  const openPeriodHasQuarterly = openPeriod
    ? quarterlyCheckins.some((q) => q.period_id === openPeriod.id)
    : false

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-page-title">Quarterly Reviews</h1>
          <p className="text-body text-lr-muted mt-1">Your quarterly self-assessments</p>
        </div>
        {openPeriod && !openPeriodHasQuarterly && (
          <div className="flex flex-col items-end gap-2">
            <Link href={`/quarterly-checkins/new?periodId=${openPeriod.id}`}>
              <Button className="bg-lr-accent hover:bg-lr-accent/90 text-white text-sm">
                New Quarterly Review
              </Button>
            </Link>
            <div className="text-right">
              <p className="text-xs font-medium text-lr-accent">{openPeriod.name}</p>
              <p className="text-xs text-lr-muted">
                {format(new Date(openPeriod.start_date), 'MMM d')} – {format(new Date(openPeriod.end_date), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        )}
      </div>

      {quarterlyCheckins.length === 0 ? (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-12 text-center">
          <p className="text-body text-lr-muted">No quarterly reviews yet.</p>
          {openPeriod && (
            <p className="text-sm text-lr-muted mt-2">
              Start your quarterly self-assessment for {openPeriod.name}.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {quarterlyCheckins.map((qc) => {
            const employeeSubmitted = !!qc.employee_submitted_at

            return (
              <Link key={qc.id} href={`/quarterly-checkins/${qc.id}`}>
                <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-4 hover:bg-lr-surface transition-colors cursor-pointer">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-lr-text">
                        Q{qc.period.quarter} {qc.period.year}
                      </p>
                      <p className="text-caption text-lr-muted mt-0.5">{qc.period.name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {employeeSubmitted ? (
                        <Badge variant="outline" className="text-xs bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20">
                          Submitted
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-lr-surface text-lr-muted border-lr-border">
                          Draft
                        </Badge>
                      )}
                      {qc.employee_submitted_at && (
                        <span className="text-xs text-lr-muted hidden sm:block">
                          Submitted {format(new Date(qc.employee_submitted_at), 'MMM d')}
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
