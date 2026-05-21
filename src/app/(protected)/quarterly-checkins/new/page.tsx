import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import QuarterlyCheckinEmployeeForm from '@/components/checkins/QuarterlyCheckinEmployeeForm'
import type { CompanyValue, QuarterlyCheckin, PerformancePeriod, Okr, KeyResult, Initiative } from '@/lib/types/database'

type OkrWithHierarchy = Okr & {
  key_results: (KeyResult & { initiatives: Initiative[] })[]
}

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

  // All OKRs for this period (all statuses) — used for the OKR/Deliverables/Goals summary section
  // and for the approved-only progress section below it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okrsRaw } = await (supabase as any)
    .from('okrs')
    .select('*, key_results(*, initiatives(*))')
    .eq('employee_id', user.id)
    .eq('period_id', periodId)
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
  const employeeOkrs = allOkrs.filter((okr) => okr.status === 'APPROVED')

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

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-kicker">{period.name}</p>
        <h1 className="text-page-title mt-1">
          Q{period.quarter} {period.year} Quarterly Check-in
        </h1>
        <p className="text-body text-lr-muted mt-1">
          Self-assess OKR progress, reflect on continue/stop/start, and surface needs for next quarter.
        </p>
      </div>

      <QuarterlyCheckinEmployeeForm
        periodId={periodId}
        checkin={existing}
        employeeOkrs={employeeOkrs}
        allOkrs={allOkrs}
        companyValues={companyValues}
        readOnly={false}
      />
    </div>
  )
}
