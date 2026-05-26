import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import QuarterlyScoringForm from '@/components/performance/QuarterlyScoringForm'
import type { Checkin, CompanyValue, Initiative, KeyResult, Okr, PerformancePeriod, Profile, QuarterlyCheckin, QuarterlyScore, SubordinateRow } from '@/lib/types/database'

function getInitials(name: string | null, email: string) {
  if (name) return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

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
    .select('full_name, email, avatar_url, created_at')
    .eq('id', employeeId)
    .single()
  const employee = empRaw as Pick<Profile, 'full_name' | 'email' | 'avatar_url'> | null
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

  // Fetch employee's OKRs for this period with full KR + initiative progress
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

  // Fetch employee's check-ins for this period
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

  // Fetch employee's quarterly check-in (for self-assessments)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: empCheckinRaw } = await (supabase as any)
    .from('quarterly_checkins')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('period_id', periodId)
    .maybeSingle()
  const employeeQuarterlyCheckin = empCheckinRaw as QuarterlyCheckin | null

  const employeeName = employee.full_name ?? employee.email
  const existingScores = existing ? {
    pm: existing.professional_mastery,
    okrs: existing.okrs_stretch_goals,
    bv: existing.behaviours_values,
  } : null

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link href={`/team/${employeeId}`} className="inline-flex items-center gap-1.5 text-sm text-lr-muted hover:text-lr-text transition-colors">
        ← {employeeName}
      </Link>

      {/* Dashboard header */}
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-lr-accent/60 via-lr-accent to-lr-accent/60" />

        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Employee info */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={employee.avatar_url ?? undefined} />
              <AvatarFallback className="bg-lr-accent text-white font-semibold">
                {getInitials(employee.full_name, employee.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-lr-text truncate">{employeeName}</h1>
                <Badge variant="outline" className="text-[10px] bg-lr-accent-dim text-lr-accent border-lr-accent/20 shrink-0">
                  {period.name}
                </Badge>
              </div>
              <p className="text-sm text-lr-muted mt-0.5">Quarterly Scoring — Q{period.quarter} {period.year}</p>
            </div>
          </div>

          {/* Score summary — shows saved scores if they exist */}
          {existingScores && (
            <div className="flex items-center gap-px shrink-0">
              {[
                { label: 'PM', value: existingScores.pm },
                { label: 'Goals', value: existingScores.okrs },
                { label: 'B&V', value: existingScores.bv },
              ].map((s, i) => (
                <div key={s.label} className={[
                  'flex flex-col items-center px-4 py-2',
                  i < 2 ? 'border-r border-lr-border/50' : '',
                ].join(' ')}>
                  <span className="text-2xl font-bold text-lr-accent tabular-nums">{s.value ?? '—'}</span>
                  <span className="text-[10px] text-lr-muted uppercase tracking-wide mt-0.5">{s.label}</span>
                </div>
              ))}
            </div>
          )}
          {!existingScores && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-lr-muted/60 italic">No scores saved yet</span>
            </div>
          )}
        </div>
      </div>

      <QuarterlyScoringForm
        employeeId={employeeId}
        periodId={periodId}
        periodName={period.name}
        employeeName={employeeName}
        okrsWithProgress={okrsWithProgress}
        checkins={checkins}
        existing={existing}
        companyValues={companyValues}
        employeeQuarterlyCheckin={employeeQuarterlyCheckin}
      />
    </div>
  )
}
