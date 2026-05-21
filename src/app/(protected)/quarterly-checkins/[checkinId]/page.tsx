import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import QuarterlyCheckinEmployeeForm from '@/components/checkins/QuarterlyCheckinEmployeeForm'
import ScheduleCallButton from '@/components/checkins/ScheduleCallButton'
import type { CompanyValue, QuarterlyCheckin, PerformancePeriod, Profile } from '@/lib/types/database'
import type { MonthlyMood } from '@/components/checkins/MoodTrendSummary'

export const dynamic = 'force-dynamic'

type CheckinWithPeriod = QuarterlyCheckin & { period: PerformancePeriod }

export default async function QuarterlyCheckinDetailPage({
  params,
}: {
  params: Promise<{ checkinId: string }>
}) {
  const { checkinId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as Profile | null
  if (!profile) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: checkinRaw } = await (supabase as any)
    .from('quarterly_checkins')
    .select('*, period:performance_periods!period_id(*)')
    .eq('id', checkinId)
    .maybeSingle()

  if (!checkinRaw) notFound()
  const checkin = checkinRaw as CheckinWithPeriod

  // Access: employee sees their own; manager/HR can read (no feedback form)
  const isOwner = checkin.employee_id === user.id
  const isHRAdmin = profile.role === 'HR_ADMIN'
  const isManager = profile.role === 'MANAGER' || isHRAdmin

  if (!isOwner && !isManager) redirect('/quarterly-checkins')

  if (!isOwner && isManager && !isHRAdmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: closureCheck } = await (supabase as any)
      .from('org_closure').select('depth')
      .eq('ancestor_id', user.id).eq('descendant_id', checkin.employee_id).gt('depth', 0).maybeSingle()
    if (!closureCheck) redirect('/quarterly-checkins')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cvRaw } = await (supabase as any)
    .from('company_values')
    .select('*')
    .order('sort_order', { ascending: true })
  const companyValues = (cvRaw ?? []) as CompanyValue[]

  const employeeSubmitted = !!checkin.employee_submitted_at

  // Load mood data from monthly check-ins for this period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: moodCheckinsRaw } = await (supabase as any)
    .from('checkins')
    .select('month, year, mood_energy, mood_productivity')
    .eq('employee_id', checkin.employee_id)
    .eq('period_id', checkin.period_id)
    .order('month', { ascending: true })
    .limit(3)

  const monthlyMoods: MonthlyMood[] = (moodCheckinsRaw ?? []).map((c: { month: number; year: number; mood_energy: string | null; mood_productivity: string | null }) => ({
    month: c.month,
    year: c.year,
    mood_energy: c.mood_energy as MonthlyMood['mood_energy'],
    mood_productivity: c.mood_productivity as MonthlyMood['mood_productivity'],
  }))

  // Fetch manager email for calendar invite
  let managerEmail: string | null = null
  if (profile.manager_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mgr } = await (supabase as any)
      .from('profiles').select('email').eq('id', profile.manager_id).single()
    managerEmail = mgr?.email ?? null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-kicker">{checkin.period.name}</p>
          <h1 className="text-page-title mt-1">
            Q{checkin.period.quarter} {checkin.period.year} Quarterly Check-in
          </h1>
          <div className="flex items-center gap-2 mt-2">
            {employeeSubmitted ? (
              <Badge variant="outline" className="text-xs bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20">Submitted</Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-lr-surface text-lr-muted border-lr-border">Draft</Badge>
            )}
          </div>
        </div>
        {isOwner && (
          <ScheduleCallButton
            title={`${profile?.full_name ?? 'Quarterly'} — Q${checkin.period.quarter} ${checkin.period.year} Quarterly Check-in`}
            description={`Quarterly performance check-in for ${checkin.period.name}. Review goal achievements, reflect on the quarter, and plan goals for next quarter.${process.env.NEXT_PUBLIC_SITE_URL ? `\n\nOpen check-in: ${process.env.NEXT_PUBLIC_SITE_URL}/quarterly-checkins/${checkin.id}` : ''}`}
            managerEmail={managerEmail}
            recurrenceLabel="Quarterly"
            recurrenceRule="RRULE:FREQ=MONTHLY;INTERVAL=3"
          />
        )}
      </div>

      <QuarterlyCheckinEmployeeForm
        periodId={checkin.period_id}
        checkin={checkin}
        companyValues={companyValues}
        monthlyReflections={[]}
        monthlyMoods={monthlyMoods}
        initialGoals={[]}
        readOnly={!isOwner || employeeSubmitted}
      />
    </div>
  )
}
