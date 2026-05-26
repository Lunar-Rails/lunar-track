import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import DeleteQuarterlyCheckinButton from '@/components/checkins/DeleteQuarterlyCheckinButton'
import type { PerformancePeriod, QuarterlyCheckin, Profile } from '@/lib/types/database'
import ScheduleCallButton from '@/components/checkins/ScheduleCallButton'

export const metadata: Metadata = { title: 'Quarterly Reviews · CiaoBob' }

export const dynamic = 'force-dynamic'

type QuarterlyCheckinWithPeriod = QuarterlyCheckin & {
  period: Pick<PerformancePeriod, 'id' | 'name' | 'status' | 'quarter' | 'year'>
}

export default async function QuarterlyCheckinsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile to get manager_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any)
    .from('profiles').select('manager_id').eq('id', user.id).single()
  const profile = profileRaw as Pick<Profile, 'manager_id'> | null

  let managerEmail: string | null = null
  if (profile?.manager_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mgrRaw } = await (supabase as any)
      .from('profiles').select('email').eq('id', profile.manager_id).single()
    managerEmail = (mgrRaw as Pick<Profile, 'email'> | null)?.email ?? null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: openPeriodRaw } = await (supabase as any)
    .from('performance_periods')
    .select('id, name, start_date, end_date, quarter, year')
    .eq('status', 'open')
    .order('year', { ascending: false })
    .order('quarter', { ascending: false })
    .limit(1)
    .maybeSingle()
  const openPeriod = openPeriodRaw as Pick<PerformancePeriod, 'id' | 'name' | 'start_date' | 'end_date' | 'quarter' | 'year'> | null

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
            <div className="flex items-center gap-2">
              {managerEmail && (
                <ScheduleCallButton
                  title={`Q${openPeriod.quarter} Quarterly Review – ${openPeriod.year}`}
                  managerEmail={managerEmail}
                  description="Quarterly review meeting — CiaoBob"
                  recurrenceLabel="Quarterly"
                  recurrenceRule="RRULE:FREQ=MONTHLY;INTERVAL=3"
                />
              )}
              <Link href={`/quarterly-checkins/new?periodId=${openPeriod.id}`}>
                <Button className="bg-lr-accent hover:bg-lr-accent/90 text-white text-sm">
                  New Quarterly Review
                </Button>
              </Link>
            </div>
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
              <div key={qc.id} className="group flex items-center gap-2 rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] hover:bg-lr-surface transition-colors">
                <Link href={`/quarterly-checkins/${qc.id}`} className="flex-1 p-4">
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
                </Link>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-3">
                  <DeleteQuarterlyCheckinButton checkinId={qc.id} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
