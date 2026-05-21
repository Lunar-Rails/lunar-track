import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import EmployeeCheckinForm from '@/components/checkins/EmployeeCheckinForm'
import ManagerCheckinForm from '@/components/checkins/ManagerCheckinForm'
import type { Checkin, PerformancePeriod, Profile } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

type CheckinWithPeriod = Checkin & { period: PerformancePeriod }

export default async function CheckinDetailPage({
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
    .from('checkins')
    .select('*, period:performance_periods!period_id(*)')
    .eq('id', checkinId)
    .maybeSingle()

  if (!checkinRaw) notFound()
  const checkin = checkinRaw as CheckinWithPeriod

  // Access control: employee sees their own; manager must be in the reporting chain; HR_ADMIN sees all
  const isOwner = checkin.employee_id === user.id
  const isHRAdmin = profile.role === 'HR_ADMIN'
  const isManager = profile.role === 'MANAGER' || isHRAdmin

  if (!isOwner && !isManager) redirect('/checkins')

  // For non-HR managers verify they manage this employee
  if (!isOwner && isManager && !isHRAdmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: closureCheck } = await (supabase as any)
      .from('org_closure').select('depth')
      .eq('ancestor_id', user.id).eq('descendant_id', checkin.employee_id).gt('depth', 0).maybeSingle()
    if (!closureCheck) redirect('/checkins')
  }

  const employeeSubmitted = !!checkin.employee_submitted_at
  const managerSubmitted = !!checkin.manager_submitted_at

  // fetch approved OKRs for okrOptions dropdown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okrsRaw } = await (supabase as any)
    .from('okrs')
    .select('id, title')
    .eq('employee_id', checkin.employee_id)
    .eq('period_id', checkin.period_id)
    .eq('status', 'APPROVED')

  const okrOptions = (okrsRaw ?? []).map((o: { id: string; title: string }) => ({
    id: o.id,
    label: o.title,
  }))

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-kicker">{checkin.period.name}</p>
        <h1 className="text-page-title mt-1">
          {MONTH_NAMES[checkin.month - 1]} {checkin.year} Check-in
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
          <EmployeeCheckinForm
            periodId={checkin.period_id}
            month={checkin.month}
            year={checkin.year}
            checkin={checkin}
            okrOptions={okrOptions}
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
            <ManagerCheckinForm
              checkin={checkin}
              readOnly={!isManager || managerSubmitted}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
