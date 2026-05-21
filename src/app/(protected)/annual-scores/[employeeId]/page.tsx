import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AnnualScoreForm from '@/components/performance/AnnualScoreForm'
import type { AnnualScore, PerformancePeriod, Profile, QuarterlyScore, SubordinateRow } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export default async function AnnualScorePage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ year?: string }>
}) {
  const { employeeId } = await params
  const { year: yearParam } = await searchParams
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()

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

  // Fetch quarterly scores for this year (across all periods)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: qscoresRaw } = await (supabase as any)
    .from('quarterly_scores')
    .select('*, period:performance_periods!period_id(id, name, year, quarter)')
    .eq('employee_id', employeeId)
  const qscores = (qscoresRaw ?? []) as (QuarterlyScore & { period: PerformancePeriod })[]
  const yearScores = qscores.filter((s) => s.period.year === year && s.professional_mastery !== null)

  // Compute suggested averages
  const suggested = {
    professional_mastery: yearScores.length > 0
      ? Math.round((yearScores.reduce((sum, s) => sum + (s.professional_mastery ?? 0), 0) / yearScores.length) * 100) / 100
      : null,
    okrs_stretch_goals: yearScores.length > 0
      ? Math.round((yearScores.reduce((sum, s) => sum + (s.okrs_stretch_goals ?? 0), 0) / yearScores.length) * 100) / 100
      : null,
    behaviours_values: yearScores.length > 0
      ? Math.round((yearScores.reduce((sum, s) => sum + (s.behaviours_values ?? 0), 0) / yearScores.length) * 100) / 100
      : null,
  }

  // Fetch existing annual score
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: annualRaw } = await (supabase as any)
    .from('annual_scores')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('year', year)
    .maybeSingle()
  const existing = annualRaw as AnnualScore | null

  const employeeName = employee.full_name ?? employee.email

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-page-title">{year} Annual Score</h1>
        <p className="text-body text-lr-muted mt-1">{employeeName}</p>
        {yearScores.length > 0 && (
          <p className="text-caption text-lr-muted mt-1">
            Based on {yearScores.length} completed quarter{yearScores.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {yearScores.length === 0 && (
        <div className="rounded-[var(--radius-lr)] border border-lr-gold/20 bg-lr-gold-dim px-4 py-3 text-sm text-lr-gold">
          No quarterly scores for {year} yet. Complete at least one quarterly score before finalizing.
        </div>
      )}

      {/* Quarterly scores breakdown */}
      {yearScores.length > 0 && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5">
          <h3 className="text-card-title mb-3">Quarterly Breakdown</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-section-label text-left">
                <th className="pb-2 pr-4">Quarter</th>
                <th className="pb-2 pr-4 text-center">PM</th>
                <th className="pb-2 pr-4 text-center">OKRs</th>
                <th className="pb-2 text-center">B/V</th>
              </tr>
            </thead>
            <tbody>
              {yearScores.map((s) => (
                <tr key={s.id} className="border-t border-lr-border">
                  <td className="py-2 pr-4 text-lr-text">{s.period.name}</td>
                  <td className="py-2 pr-4 text-center text-lr-text">{s.professional_mastery}</td>
                  <td className="py-2 pr-4 text-center text-lr-text">{s.okrs_stretch_goals}</td>
                  <td className="py-2 text-center text-lr-text">{s.behaviours_values}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-lr-border font-medium">
                <td className="pt-2 pr-4 text-lr-text">Average</td>
                <td className="pt-2 pr-4 text-center text-lr-accent">{suggested.professional_mastery?.toFixed(2) ?? '—'}</td>
                <td className="pt-2 pr-4 text-center text-lr-accent">{suggested.okrs_stretch_goals?.toFixed(2) ?? '—'}</td>
                <td className="pt-2 text-center text-lr-accent">{suggested.behaviours_values?.toFixed(2) ?? '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <AnnualScoreForm
        employeeId={employeeId}
        employeeName={employeeName}
        year={year}
        suggested={suggested}
        existing={existing}
      />
    </div>
  )
}
