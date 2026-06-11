import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import type { Checkin, PerformancePeriod, Profile } from '@/lib/types/database'
import ScheduleCallButton from '@/components/checkins/ScheduleCallButton'

export const metadata: Metadata = { title: 'Monthly Check-ins · CiaoBob' }

export const dynamic = 'force-dynamic'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_NAMES_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

type CheckinWithPeriod = Checkin & { period: Pick<PerformancePeriod, 'id' | 'name' | 'status'> }

function daysUntil(dateStr: string): number {
  const end = new Date(dateStr)
  const now = new Date()
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function CheckinsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams
  const tab: 'monthly' | 'weekly' = tabParam === 'weekly' ? 'weekly' : 'monthly'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let weeklyCheckins: { id: string; week_start: string; problems: string | null }[] = []
  if (tab === 'weekly') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('weekly_checkins')
      .select('id, week_start, problems')
      .eq('employee_id', user.id)
      .order('week_start', { ascending: false })
    weeklyCheckins = data ?? []
  }

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
    .select('id, name, start_date, end_date')
    .eq('status', 'open')
    .order('year', { ascending: false })
    .order('quarter', { ascending: false })
    .limit(1)
    .maybeSingle()
  const openPeriod = openPeriodRaw as Pick<PerformancePeriod, 'id' | 'name' | 'start_date' | 'end_date'> | null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: checkinsRaw, error: checkinsErr } = await (supabase as any)
    .from('checkins')
    .select('*, period:performance_periods!period_id(id,name,status)')
    .eq('employee_id', user.id)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  if (checkinsErr) console.error('[checkins] fetch failed:', checkinsErr.message)
  const checkins = (checkinsRaw ?? []) as CheckinWithPeriod[]

  const tabBase = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-lr-md)] text-sm font-medium transition-colors'
  const tabActive = 'bg-lr-accent text-white'
  const tabInactive = 'text-lr-muted hover:text-lr-text hover:bg-lr-surface'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-page-title">Monthly Check-ins</h1>
          <p className="text-body text-lr-muted mt-1">Your monthly performance check-ins</p>
        </div>
        {openPeriod && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {managerEmail && (
                <ScheduleCallButton
                  title={`Monthly Check-in – ${MONTH_NAMES_LONG[new Date().getMonth()]} ${new Date().getFullYear()}`}
                  managerEmail={managerEmail}
                  description="Monthly check-in meeting — CiaoBob"
                  recurrenceLabel="Monthly"
                  recurrenceRule="RRULE:FREQ=MONTHLY"
                />
              )}
              <Link href={`/checkins/new?periodId=${openPeriod.id}`}>
                <Button className="bg-lr-accent hover:bg-lr-accent/90 text-white text-sm">
                  New Check-in
                </Button>
              </Link>
            </div>
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

      <div className="flex items-center gap-2 border-b border-lr-border pb-3">
        <Link href="/checkins?tab=monthly" className={`${tabBase} ${tab === 'monthly' ? tabActive : tabInactive}`}>
          Monthly
        </Link>
        <Link href="/checkins?tab=weekly" className={`${tabBase} ${tab === 'weekly' ? tabActive : tabInactive}`}>
          Weekly <span className="text-[10px] uppercase tracking-wide opacity-70">Beta</span>
        </Link>
      </div>

      {tab === 'monthly' && (checkins.length === 0 ? (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-12 text-center">
          <p className="text-body text-lr-muted">No check-ins yet.</p>
          {openPeriod && (
            <p className="text-sm text-lr-muted mt-2">
              Start your first check-in for {openPeriod.name}.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {checkins.map((checkin) => {
            const employeeSubmitted = !!checkin.employee_submitted_at

            return (
              <Link key={checkin.id} href={`/checkins/${checkin.id}`}>
                <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] px-5 py-4 hover:bg-lr-surface hover:border-lr-accent/30 transition-all cursor-pointer group">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={[
                        'w-1 h-8 rounded-full shrink-0 transition-colors',
                        employeeSubmitted ? 'bg-lr-cyan/60' : 'bg-lr-border group-hover:bg-lr-accent/40',
                      ].join(' ')} />
                      <div>
                        <p className="text-sm font-semibold text-lr-text">
                          {MONTH_NAMES[checkin.month - 1]} {checkin.year}
                        </p>
                        <p className="text-xs text-lr-muted mt-0.5">{checkin.period.name}</p>
                      </div>
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
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ))}


      {tab === 'weekly' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link href="/weekly-checkins/new">
              <Button className="bg-lr-accent hover:bg-lr-accent/90 text-white text-sm">New weekly check-in</Button>
            </Link>
          </div>
          {weeklyCheckins.length === 0 ? (
            <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-12 text-center">
              <p className="text-body text-lr-muted">No weekly check-ins yet.</p>
            </div>
          ) : (
            weeklyCheckins.map((w) => (
              <Link key={w.id} href={`/weekly-checkins/${w.id}`}>
                <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-4 hover:bg-lr-surface transition-colors">
                  <p className="text-sm font-medium text-lr-text">
                    Week of {new Date(`${w.week_start}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                  </p>
                  {w.problems?.trim() && <p className="text-caption text-lr-muted mt-0.5 line-clamp-1">⚠ {w.problems}</p>}
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
