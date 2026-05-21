import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import QuarterlyCheckinEmployeeForm from '@/components/checkins/QuarterlyCheckinEmployeeForm'
import ScheduleCallButton from '@/components/checkins/ScheduleCallButton'
import type { CompanyValue, QuarterlyCheckin, PerformancePeriod, QuarterlyGoal, QuarterlyGoalReview } from '@/lib/types/database'
import type { MonthlyMood } from '@/components/checkins/MoodTrendSummary'

export const dynamic = 'force-dynamic'

export default async function NewQuarterlyCheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ periodId?: string }>
}) {
  const { periodId: periodIdParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any)
    .from('profiles')
    .select('id, manager_id, full_name')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as { id: string; manager_id: string | null; full_name: string | null } | null
  if (!profile) redirect('/login')

  let managerEmail: string | null = null
  if (profile.manager_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mgr } = await (supabase as any)
      .from('profiles')
      .select('email')
      .eq('id', profile.manager_id)
      .single()
    managerEmail = mgr?.email ?? null
  }

  // Resolve period: either supplied or latest open
  let periodId = periodIdParam
  let period: PerformancePeriod | null = null

  if (periodId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pRaw } = await (supabase as any)
      .from('performance_periods')
      .select('*')
      .eq('id', periodId)
      .maybeSingle()
    period = pRaw as PerformancePeriod | null
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pRaw } = await (supabase as any)
      .from('performance_periods')
      .select('*')
      .eq('status', 'open')
      .order('year', { ascending: false })
      .order('quarter', { ascending: false })
      .limit(1)
      .maybeSingle()
    period = pRaw as PerformancePeriod | null
    periodId = period?.id
  }

  if (!period || !periodId) {
    return (
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-page-title">Quarterly Check-in</h1>
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-12 text-center">
          <p className="text-body text-lr-muted">No open performance period found.</p>
          <p className="text-sm text-lr-muted mt-2">Ask HR Admin to open a quarterly period.</p>
        </div>
      </div>
    )
  }

  // Existing quarterly check-in for this period (only one allowed)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingRaw } = await (supabase as any)
    .from('quarterly_checkins')
    .select('*')
    .eq('employee_id', user.id)
    .eq('period_id', periodId)
    .maybeSingle()

  const existing = existingRaw as QuarterlyCheckin | null
  if (existing?.employee_submitted_at) {
    redirect(`/quarterly-checkins/${existing.id}`)
  }

  // Company values for self-assessment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cvRaw } = await (supabase as any)
    .from('company_values')
    .select('*')
    .order('sort_order', { ascending: true })
  const companyValues = (cvRaw ?? []) as CompanyValue[]

  // Fetch 3 monthly check-ins for this quarter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: monthlyCheckins } = await (supabase as any)
    .from('checkins')
    .select('month, year, done_well, do_differently, mood_energy, mood_productivity')
    .eq('employee_id', profile.id)
    .eq('period_id', period.id)
    .order('month', { ascending: true })
    .limit(3)

  const monthlyReflections = (monthlyCheckins ?? []).map((c: { month: number; year: number; done_well: string | null; do_differently: string | null }) => ({
    month: c.month,
    year: c.year,
    done_well: c.done_well,
    do_differently: c.do_differently,
  }))

  const monthlyMoods: MonthlyMood[] = (monthlyCheckins ?? []).map((c: { month: number; year: number; mood_energy: string | null; mood_productivity: string | null }) => ({
    month: c.month,
    year: c.year,
    mood_energy: c.mood_energy as MonthlyMood['mood_energy'],
    mood_productivity: c.mood_productivity as MonthlyMood['mood_productivity'],
  }))

  // Fetch previous quarter's check-in to get goals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prevPeriodRaw } = await (supabase as any)
    .from('performance_periods')
    .select('id')
    .eq('year', period.quarter === 1 ? period.year - 1 : period.year)
    .eq('quarter', period.quarter === 1 ? 4 : period.quarter - 1)
    .maybeSingle()

  let prevQuarterGoals: QuarterlyGoalReview[] = []
  if (prevPeriodRaw?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prevCheckin } = await (supabase as any)
      .from('quarterly_checkins')
      .select('next_quarter_goals')
      .eq('employee_id', profile.id)
      .eq('period_id', prevPeriodRaw.id)
      .maybeSingle()
    if (prevCheckin?.next_quarter_goals) {
      prevQuarterGoals = (prevCheckin.next_quarter_goals as QuarterlyGoal[]).map((g) => ({
        ...g,
        status: null,
      }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-kicker">{period.name}</p>
          <h1 className="text-page-title mt-1">
            Q{period.quarter} {period.year} Quarterly Check-in
          </h1>
          <p className="text-body text-lr-text/70 mt-1">
            Reflect on your goals, what went well, and plan the quarter ahead.
          </p>
        </div>
        <ScheduleCallButton
          title={`${profile?.full_name ?? 'Quarterly'} — Q${period.quarter} ${period.year} Quarterly Check-in`}
          description={`Quarterly performance check-in for ${period.name}. Review goal achievements, reflect on the quarter, and plan goals for next quarter.${process.env.NEXT_PUBLIC_SITE_URL ? `\n\nOpen check-in: ${process.env.NEXT_PUBLIC_SITE_URL}/quarterly-checkins` : ''}`}
          managerEmail={managerEmail}
          recurrenceLabel="Quarterly"
          recurrenceRule="RRULE:FREQ=MONTHLY;INTERVAL=3"
        />
      </div>

      <QuarterlyCheckinEmployeeForm
        periodId={periodId}
        checkin={existing}
        companyValues={companyValues}
        monthlyReflections={monthlyReflections}
        monthlyMoods={monthlyMoods}
        initialGoals={prevQuarterGoals}
        readOnly={false}
      />
    </div>
  )
}
