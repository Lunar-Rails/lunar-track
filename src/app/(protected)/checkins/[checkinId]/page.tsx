import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import EmployeeCheckinForm from '@/components/checkins/EmployeeCheckinForm'
import ScheduleCallButton from '@/components/checkins/ScheduleCallButton'
import ReopenCheckinButton from '@/components/checkins/ReopenCheckinButton'
import ManagerCheckinNotes from '@/components/checkins/ManagerCheckinNotes'
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

  // Access: employee sees their own; manager/HR can read (no feedback form)
  const isOwner = checkinRaw.employee_id === user.id
  const isHRAdmin = profile.role === 'HR_ADMIN'
  const isManager = profile.role === 'MANAGER' || isHRAdmin
  const isManagerViewer = isManager && !isOwner

  // Strip mgr_private_note from the serialised RSC payload for non-manager viewers.
  // All client components on this page receive `checkin` as a prop; stripping at
  // the assignment site ensures the field never travels to the employee's browser.
  const checkin = (
    isManagerViewer ? checkinRaw : { ...checkinRaw, mgr_private_note: null }
  ) as CheckinWithPeriod

  if (!isOwner && !isManager) redirect('/checkins')

  if (!isOwner && isManager && !isHRAdmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: closureCheck } = await (supabase as any)
      .from('org_closure').select('depth')
      .eq('ancestor_id', user.id).eq('descendant_id', checkin.employee_id).gt('depth', 0).maybeSingle()
    if (!closureCheck) redirect('/checkins')
  }

  const employeeSubmitted = !!checkin.employee_submitted_at

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okrsRaw } = await (supabase as any)
    .from('okrs')
    .select('id, title')
    .eq('employee_id', checkin.employee_id)
    .eq('period_id', checkin.period_id)
    .is('deleted_at', null)

  const okrOptions = (okrsRaw ?? []).map((o: { id: string; title: string }) => ({
    id: o.id,
    label: o.title,
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
            {MONTH_NAMES[checkin.month - 1]} {checkin.year} Check-in
          </h1>
          <div className="flex items-center gap-2 mt-2">
            {employeeSubmitted ? (
              <Badge variant="outline" className="text-xs bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20">Submitted</Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-lr-surface text-lr-muted border-lr-border">Draft</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {isOwner && employeeSubmitted && checkin.period.status === 'open' && (
            <ReopenCheckinButton checkinId={checkin.id} />
          )}
          {isOwner && (
          <ScheduleCallButton
            title={`${profile?.full_name ?? 'Monthly'} — Monthly Check-in — ${MONTH_NAMES[checkin.month - 1]} ${checkin.year}`}
            description={`Monthly performance check-in for ${checkin.period.name}. Review commitments from last month and plan next month's priorities.${process.env.NEXT_PUBLIC_SITE_URL ? `\n\nOpen check-in: ${process.env.NEXT_PUBLIC_SITE_URL}/checkins/${checkin.id}` : ''}`}
            managerEmail={managerEmail}
            recurrenceLabel="Monthly"
            recurrenceRule="RRULE:FREQ=MONTHLY"
          />
          )}
        </div>
      </div>

      <EmployeeCheckinForm
        periodId={checkin.period_id}
        month={checkin.month}
        year={checkin.year}
        checkin={checkin}
        okrOptions={okrOptions}
        readOnly={!isOwner || employeeSubmitted}
      />

      {/* Manager notes — shown to manager (editable) and to employee after manager submits */}
      {employeeSubmitted && (isManager || !!checkin.manager_submitted_at) && (
        <ManagerCheckinNotes
          checkin={checkin}
          isEditable={isManagerViewer}
        />
      )}
    </div>
  )
}
