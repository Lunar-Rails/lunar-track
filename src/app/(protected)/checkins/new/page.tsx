import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EmployeeCheckinForm from '@/components/checkins/EmployeeCheckinForm'
import MonthSelector from '@/components/checkins/MonthSelector'
import ScheduleCallButton from '@/components/checkins/ScheduleCallButton'
import WeeklyHighlights from '@/components/checkins/WeeklyHighlights'
import { monthRange } from '@/lib/week'
import type { PerformancePeriod, WeeklyCheckin } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function quarterMonths(quarter: number): number[] {
  return [1, 2, 3].map((i) => (quarter - 1) * 3 + i)
}

export default async function NewCheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ periodId?: string; month?: string; year?: string }>
}) {
  const { periodId, month: monthParam, year: yearParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!periodId) redirect('/checkins')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: periodRaw } = await (supabase as any)
    .from('performance_periods')
    .select('*')
    .eq('id', periodId)
    .eq('status', 'open')
    .maybeSingle()

  if (!periodRaw) redirect('/checkins')
  const period = periodRaw as PerformancePeriod

  const now = new Date()
  const months = quarterMonths(period.quarter)

  // Fetch existing check-ins for this period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingRaw } = await (supabase as any)
    .from('checkins')
    .select('id, month, year')
    .eq('employee_id', user.id)
    .eq('period_id', periodId)

  const existing = (existingRaw ?? []) as { id: string; month: number; year: number }[]

  const monthOptions = months.map((m) => ({
    month: m,
    year: period.year,
    hasCheckin: existing.some((c) => c.month === m && c.year === period.year),
  }))

  // If user explicitly picked a month via URL, honour it
  let month: number
  let year: number

  if (monthParam && yearParam) {
    month = parseInt(monthParam, 10)
    year = parseInt(yearParam, 10)
    // If that month already has a check-in, redirect to it
    const match = existing.find((c) => c.month === month && c.year === year)
    if (match) redirect(`/checkins/${match.id}`)
  } else {
    // Default: find the first month in the quarter that has no check-in yet
    const free = monthOptions.find((o) => !o.hasCheckin)
    if (!free) redirect('/checkins') // all months done — go to list
    month = free.month
    year = free.year
  }

  const { start, endExclusive } = monthRange(year, month)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: weeksRaw } = await (supabase as any)
    .from('weekly_checkins').select('*').eq('employee_id', user.id)
    .gte('week_start', start).lt('week_start', endExclusive).order('week_start', { ascending: true })
  const weeks = (weeksRaw ?? []) as WeeklyCheckin[]
  const monthlyMitTitles: string[] = []

  // Fetch profile + manager email for calendar invite
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any)
    .from('profiles')
    .select('manager_id, full_name')
    .eq('id', user.id)
    .single()
  let managerEmail: string | null = null
  if (profileRaw?.manager_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mgr } = await (supabase as any)
      .from('profiles')
      .select('email')
      .eq('id', profileRaw.manager_id)
      .single()
    managerEmail = mgr?.email ?? null
  }

  // fetch OKRs for okrOptions dropdown (exclude deleted)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okrsRaw } = await (supabase as any)
    .from('okrs')
    .select('id, title')
    .eq('employee_id', user.id)
    .eq('period_id', period.id)
    .is('deleted_at', null)

  const okrOptions = (okrsRaw ?? []).map((o: { id: string; title: string }) => ({
    id: o.id,
    label: o.title,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-kicker">{period.name}</p>
          <h1 className="text-page-title mt-1">
            {MONTH_NAMES[month - 1]} {year} Check-in
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ScheduleCallButton
            title={`${(profileRaw as any)?.full_name ?? 'Monthly'} — Monthly Check-in — ${MONTH_NAMES[month - 1]} ${year}`}
            description={`Monthly performance check-in for ${period.name}. Review commitments from last month and plan next month's priorities.${process.env.NEXT_PUBLIC_SITE_URL ? `\n\nOpen check-in: ${process.env.NEXT_PUBLIC_SITE_URL}/checkins` : ''}`}
            managerEmail={managerEmail}
            recurrenceLabel="Monthly"
            recurrenceRule="RRULE:FREQ=MONTHLY"
          />
          <MonthSelector
            periodId={periodId}
            selectedMonth={month}
            selectedYear={year}
            options={monthOptions}
          />
        </div>
      </div>
      <EmployeeCheckinForm
        periodId={periodId}
        month={month}
        year={year}
        checkin={null}
        okrOptions={okrOptions}
        readOnly={false}
      />
      <WeeklyHighlights weeks={weeks} monthlyMitTitles={monthlyMitTitles} />
    </div>
  )
}
