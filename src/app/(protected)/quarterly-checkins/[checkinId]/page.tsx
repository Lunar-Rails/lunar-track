import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import QuarterlyCheckinEmployeeForm from '@/components/checkins/QuarterlyCheckinEmployeeForm'
import ScheduleCallButton from '@/components/checkins/ScheduleCallButton'
import type { CompanyValue, QuarterlyCheckin, PerformancePeriod, Profile, QuarterlyGoalReview } from '@/lib/types/database'
import type { LinkOption } from '@/components/checkins/MitPlanList'

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

  // Fetch manager email for calendar invite
  let managerEmail: string | null = null
  if (profile.manager_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mgr } = await (supabase as any)
      .from('profiles').select('email').eq('id', profile.manager_id).single()
    managerEmail = mgr?.email ?? null
  }

  // Load goals from okrs table — single source of truth, merge with saved achievement statuses
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okrsRaw } = await (supabase as any)
    .from('okrs')
    .select('id, title, description')
    .eq('employee_id', checkin.employee_id)
    .eq('period_id', checkin.period_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const okrsForPeriod = (okrsRaw ?? []) as { id: string; title: string; description: string | null }[]

  // Merge saved achievement statuses from JSONB with live okrs list
  const savedGoalStatus = new Map(
    ((checkin.goals as QuarterlyGoalReview[] | null) ?? []).map((g) => [g.id, g.status])
  )

  const initialGoals: QuarterlyGoalReview[] = okrsForPeriod.map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description ?? '',
    status: savedGoalStatus.get(o.id) ?? null,
  }))

  const okrOptions: LinkOption[] = okrsForPeriod.map((o) => ({
    id: o.id,
    label: o.title,
  }))

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
        initialGoals={initialGoals}
        okrOptions={okrOptions}
        readOnly={!isOwner || employeeSubmitted}
      />
    </div>
  )
}
