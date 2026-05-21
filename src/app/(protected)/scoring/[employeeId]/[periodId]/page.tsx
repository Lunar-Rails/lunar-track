import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import QuarterlyScoringForm from '@/components/performance/QuarterlyScoringForm'
import { KrStatusPill } from '@/components/okrs/OkrProgressControls'
import type { Checkin, CompanyValue, Initiative, KeyResult, Okr, PerformancePeriod, Profile, QuarterlyCheckin, QuarterlyScore, SubordinateRow } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export default async function QuarterlyScoringPage({
  params,
}: {
  params: Promise<{ employeeId: string; periodId: string }>
}) {
  const { employeeId, periodId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify manager role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerRaw } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const caller = callerRaw as Pick<Profile, 'role'> | null
  if (!caller || (caller.role !== 'MANAGER' && caller.role !== 'HR_ADMIN')) redirect('/dashboard')

  // Verify subordinate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subsRaw } = await (supabase as any).rpc('get_subordinates', { manager_uuid: user.id })
  const subIds = new Set(((subsRaw ?? []) as SubordinateRow[]).map((s) => s.id))
  if (!subIds.has(employeeId)) notFound()

  // Fetch employee
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: empRaw } = await (supabase as any)
    .from('profiles')
    .select('full_name, email')
    .eq('id', employeeId)
    .single()
  const employee = empRaw as Pick<Profile, 'full_name' | 'email'> | null
  if (!employee) notFound()

  // Fetch period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: periodRaw } = await (supabase as any)
    .from('performance_periods')
    .select('*')
    .eq('id', periodId)
    .single()
  const period = periodRaw as PerformancePeriod | null
  if (!period) notFound()

  // Fetch employee's OKRs for this period (with KR + initiative progress)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okrsRaw } = await (supabase as any)
    .from('okrs')
    .select('*, key_results(*, initiatives(*))')
    .eq('employee_id', employeeId)
    .eq('period_id', periodId)
  type OkrWithProgress = Okr & {
    key_results: (KeyResult & { initiatives: Initiative[] })[]
  }
  const okrsWithProgress = (okrsRaw ?? []) as OkrWithProgress[]
  okrsWithProgress.forEach((o) => {
    o.key_results = [...(o.key_results ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    o.key_results.forEach((kr) => {
      kr.initiatives = [...(kr.initiatives ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    })
  })
  // Strip progress relations for the scoring form which expects bare Okr[]
  const okrs: Okr[] = okrsWithProgress.map((o) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { key_results, ...rest } = o
    return rest as Okr
  })

  // Fetch employee's check-ins for this period (visible to manager after submission)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: checkinsRaw } = await (supabase as any)
    .from('checkins')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('period_id', periodId)
    .order('month')
  const checkins = (checkinsRaw ?? []) as Checkin[]

  // Fetch existing score
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingRaw } = await (supabase as any)
    .from('quarterly_scores')
    .select('*')
    .eq('manager_id', user.id)
    .eq('employee_id', employeeId)
    .eq('period_id', periodId)
    .maybeSingle()
  const existing = existingRaw as QuarterlyScore | null

  // Fetch company values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cvRaw } = await (supabase as any)
    .from('company_values')
    .select('*')
    .order('sort_order', { ascending: true })
  const companyValues = (cvRaw ?? []) as CompanyValue[]

  // Fetch employee's submitted quarterly check-in (for self-assessments display)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: empCheckinRaw } = await (supabase as any)
    .from('quarterly_checkins')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('period_id', periodId)
    .maybeSingle()
  const employeeQuarterlyCheckin = empCheckinRaw as QuarterlyCheckin | null

  const employeeName = employee.full_name ?? employee.email

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-kicker">{period.name}</p>
        <h1 className="text-page-title mt-1">Quarterly Score</h1>
        <p className="text-body text-lr-muted mt-1">{employeeName}</p>
      </div>

      {/* OKR Progress context for manager scoring */}
      {okrsWithProgress.length > 0 && (
        <section className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-5 space-y-4">
          <div>
            <h2 className="text-card-title">OKR / Deliverables / Goals Progress</h2>
            <p className="text-caption text-lr-muted mt-1">
              Concrete completion evidence to inform your OKRs score.
            </p>
          </div>
          <div className="space-y-4">
            {okrsWithProgress.map((okr) => {
              const allInitiatives = okr.key_results.flatMap((kr) => kr.initiatives)
              const total = allInitiatives.length
              const done = allInitiatives.filter((i) => i.completed).length
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              return (
                <div
                  key={okr.id}
                  className="rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="text-sm font-medium text-lr-text">{okr.title}</p>
                    <p className="text-caption text-lr-muted shrink-0">
                      {done}/{total} initiatives done
                    </p>
                  </div>
                  {total > 0 && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-lr-surface mb-3">
                      <div
                        className="h-full bg-lr-accent transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  {okr.key_results.length > 0 && (
                    <div className="space-y-1.5">
                      {okr.key_results.map((kr, ki) => {
                        const krInits = kr.initiatives
                        const krDone = krInits.filter((i) => i.completed).length
                        return (
                          <div key={kr.id} className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-lr-accent shrink-0">KR{ki + 1}</span>
                            <p className="text-caption flex-1 min-w-0 truncate">{kr.title}</p>
                            <span className="text-caption text-lr-muted shrink-0">
                              {krDone}/{krInits.length}
                            </span>
                            <KrStatusPill status={kr.progress_status} />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <QuarterlyScoringForm
        employeeId={employeeId}
        periodId={periodId}
        periodName={period.name}
        employeeName={employeeName}
        okrs={okrs}
        checkins={checkins}
        existing={existing}
        companyValues={companyValues}
        employeeQuarterlyCheckin={employeeQuarterlyCheckin}
      />
    </div>
  )
}
