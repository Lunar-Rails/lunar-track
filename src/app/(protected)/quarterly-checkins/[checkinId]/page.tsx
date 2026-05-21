import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import QuarterlyCheckinEmployeeForm from '@/components/checkins/QuarterlyCheckinEmployeeForm'
import QuarterlyCheckinManagerForm from '@/components/checkins/QuarterlyCheckinManagerForm'
import type { CompanyValue, QuarterlyCheckin, PerformancePeriod, Profile, Okr, KeyResult, Initiative } from '@/lib/types/database'

type OkrWithHierarchy = Okr & {
  key_results: (KeyResult & { initiatives: Initiative[] })[]
}

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

  // Employee OKRs to render in form, with full hierarchy so the form can show live progress
  // (KR statuses + initiative completion). Approved-only — DRAFT OKRs have no meaningful progress.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okrsRaw } = await (supabase as any)
    .from('okrs')
    .select('*, key_results(*, initiatives(*))')
    .eq('employee_id', checkin.employee_id)
    .eq('period_id', checkin.period_id)
    .in('status', ['APPROVED', 'DRAFT', 'PENDING_REVIEW', 'REVISION_REQUESTED'])
    .order('created_at', { ascending: true })

  const allOkrs = ((okrsRaw ?? []) as OkrWithHierarchy[]).map((okr) => {
    const krs = [...(okr.key_results ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((kr) => ({
        ...kr,
        initiatives: [...(kr.initiatives ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      }))
    return { ...okr, key_results: krs }
  })
  const employeeOkrs = allOkrs.filter((okr) => okr.status === 'APPROVED' || okr.status === 'DRAFT')

  // Company values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cvRaw } = await (supabase as any)
    .from('company_values')
    .select('*')
    .order('sort_order', { ascending: true })
  const companyValues = (cvRaw ?? []) as CompanyValue[]

  const employeeSubmitted = !!checkin.employee_submitted_at
  const managerSubmitted = !!checkin.manager_submitted_at

  return (
    <div className="space-y-6 max-w-3xl">
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
            employeeOkrs={employeeOkrs}
            allOkrs={allOkrs}
            companyValues={companyValues}
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
