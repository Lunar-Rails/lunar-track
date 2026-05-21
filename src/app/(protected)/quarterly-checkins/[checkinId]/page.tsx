import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import QuarterlyCheckinEmployeeForm from '@/components/checkins/QuarterlyCheckinEmployeeForm'
import QuarterlyCheckinManagerForm from '@/components/checkins/QuarterlyCheckinManagerForm'
import ScheduleCallButton from '@/components/checkins/ScheduleCallButton'
import type { CompanyValue, QuarterlyCheckin, PerformancePeriod, Profile } from '@/lib/types/database'

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

  // Access control
  const isOwner = checkin.employee_id === user.id
  const isHRAdmin = profile.role === 'HR_ADMIN'
  const isManager = profile.role === 'MANAGER' || isHRAdmin

  if (!isOwner && !isManager) redirect('/checkins')

  if (!isOwner && isManager && !isHRAdmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: closureCheck } = await (supabase as any)
      .from('org_closure').select('depth')
      .eq('ancestor_id', user.id).eq('descendant_id', checkin.employee_id).gt('depth', 0).maybeSingle()
    if (!closureCheck) redirect('/checkins')
  }

  // Company values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cvRaw } = await (supabase as any)
    .from('company_values')
    .select('*')
    .order('sort_order', { ascending: true })
  const companyValues = (cvRaw ?? []) as CompanyValue[]

  const employeeSubmitted = !!checkin.employee_submitted_at
  const managerSubmitted = !!checkin.manager_submitted_at

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
            {managerSubmitted ? (
              <Badge variant="outline" className="text-xs bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20">Complete</Badge>
            ) : employeeSubmitted ? (
              <Badge variant="outline" className="text-xs bg-lr-gold-dim text-lr-gold border-lr-gold/20">Awaiting Manager</Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-lr-surface text-lr-muted border-lr-border">Draft</Badge>
            )}
          </div>
        </div>
        <ScheduleCallButton
          title={`${profile?.full_name ?? 'Quarterly'} — Q${checkin.period.quarter} ${checkin.period.year} Quarterly Check-in`}
          description={`Quarterly performance check-in for ${checkin.period.name}. Review goal achievements, reflect on the quarter, and plan goals for next quarter.${process.env.NEXT_PUBLIC_SITE_URL ? `\n\nOpen check-in: ${process.env.NEXT_PUBLIC_SITE_URL}/quarterly-checkins/${checkin.id}` : ''}`}
          managerEmail={managerEmail}
          recurrenceLabel="Quarterly"
          recurrenceRule="RRULE:FREQ=MONTHLY;INTERVAL=3"
        />
      </div>

      <Tabs defaultValue="employee">
        <TabsList className="bg-lr-surface border border-lr-border">
          <TabsTrigger value="employee" className="text-sm data-[state=active]:bg-lr-accent-dim data-[state=active]:text-lr-accent">
            My Answers
          </TabsTrigger>
          <TabsTrigger
            value="manager"
            className="text-sm data-[state=active]:bg-lr-accent-dim data-[state=active]:text-lr-accent"
            disabled={!employeeSubmitted && !isManager}
          >
            Manager Feedback
          </TabsTrigger>
        </TabsList>
        {!employeeSubmitted && isOwner && (
          <p className="text-xs text-lr-muted mt-2">Manager Feedback unlocks after you submit your answers.</p>
        )}

        <TabsContent value="employee" className="mt-6">
          <QuarterlyCheckinEmployeeForm
            periodId={checkin.period_id}
            checkin={checkin}
            companyValues={companyValues}
            monthlyReflections={[]}
            initialGoals={[]}
            readOnly={!isOwner || employeeSubmitted}
          />
        </TabsContent>

        <TabsContent value="manager" className="mt-6">
          {!employeeSubmitted ? (
            <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-8 text-center">
              <p className="text-body text-lr-muted">
                Manager section unlocks after the employee submits their check-in.
              </p>
            </div>
          ) : (
            <QuarterlyCheckinManagerForm
              checkin={checkin}
              readOnly={!isManager || managerSubmitted}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
