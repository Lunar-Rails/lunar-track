import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import type { AnnualScore, Profile, QuarterlyScore } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

type QuarterlyScoreWithContext = QuarterlyScore & {
  employee: Pick<Profile, 'id' | 'full_name' | 'email'>
  period: { id: string; name: string; year: number; quarter: number }
}

type AnnualScoreWithEmployee = AnnualScore & {
  employee: Pick<Profile, 'id' | 'full_name' | 'email'>
}

export default async function ScoresAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any).from('profiles').select('role').eq('id', user.id).single()
  const profile = profileRaw as Pick<Profile, 'role'> | null
  if (!profile || profile.role !== 'HR_ADMIN') redirect('/dashboard')

  const currentYear = new Date().getFullYear()

  // Fetch all quarterly scores with employee + period info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: qscoresRaw } = await (supabase as any)
    .from('quarterly_scores')
    .select('*, employee:profiles!employee_id(id,full_name,email), period:performance_periods!period_id(id,name,year,quarter)')
    .order('created_at', { ascending: false })
  const qscores = (qscoresRaw ?? []) as QuarterlyScoreWithContext[]

  // Fetch all annual scores
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: annualRaw } = await (supabase as any)
    .from('annual_scores')
    .select('*, employee:profiles!employee_id(id,full_name,email)')
    .order('year', { ascending: false })
  const annualScores = (annualRaw ?? []) as AnnualScoreWithEmployee[]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-page-title">Scores</h1>
        <p className="text-body text-lr-muted mt-1">Quarterly and annual performance scores across all employees</p>
      </div>

      {/* Annual Scores */}
      <section>
        <h2 className="text-card-title mb-4">Annual Scores</h2>
        {annualScores.length === 0 ? (
          <p className="text-body text-lr-muted">No annual scores finalized yet.</p>
        ) : (
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-lr-border bg-lr-surface">
                  <th className="text-section-label text-left px-4 py-3">Employee</th>
                  <th className="text-section-label text-left px-4 py-3">Year</th>
                  <th className="text-section-label text-center px-4 py-3">PM</th>
                  <th className="text-section-label text-center px-4 py-3">Goals</th>
                  <th className="text-section-label text-center px-4 py-3">B/V</th>
                  <th className="text-section-label text-center px-4 py-3">Overall</th>
                </tr>
              </thead>
              <tbody>
                {annualScores.map((score) => (
                  <tr key={score.id} className="border-b border-lr-border hover:bg-lr-surface transition-colors">
                    <td className="px-4 py-3 text-lr-text">{score.employee.full_name ?? score.employee.email}</td>
                    <td className="px-4 py-3 text-lr-muted">{score.year}</td>
                    <td className="px-4 py-3 text-center text-lr-text">{Number(score.final_professional_mastery).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-lr-text">{Number(score.final_okrs_stretch_goals).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-lr-text">{Number(score.final_behaviours_values).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      {score.final_overall ? (
                        <span className="font-bold text-lr-accent">{Number(score.final_overall).toFixed(2)}</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Quarterly Scores — with visibility toggle */}
      <section>
        <h2 className="text-card-title mb-4">Quarterly Scores</h2>
        {qscores.length === 0 ? (
          <p className="text-body text-lr-muted">No quarterly scores yet.</p>
        ) : (
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-lr-border bg-lr-surface">
                  <th className="text-section-label text-left px-4 py-3">Employee</th>
                  <th className="text-section-label text-left px-4 py-3">Period</th>
                  <th className="text-section-label text-center px-4 py-3" title="Professional Mastery">PM</th>
                  <th className="text-section-label text-center px-4 py-3" title="Goals / Stretch Goals">Goals</th>
                  <th className="text-section-label text-center px-4 py-3" title="Behaviours / Values">B/V</th>
                  <th className="text-section-label text-center px-4 py-3">Visible</th>
                  <th className="text-section-label text-center px-4 py-3">Edit</th>
                </tr>
              </thead>
              <tbody>
                {qscores.map((score) => (
                  <tr key={score.id} className="border-b border-lr-border hover:bg-lr-surface transition-colors">
                    <td className="px-4 py-3 text-lr-text">{score.employee.full_name ?? score.employee.email}</td>
                    <td className="px-4 py-3 text-lr-muted">{score.period.name}</td>
                    <td className="px-4 py-3 text-center text-lr-text">{score.professional_mastery ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-lr-text">{score.okrs_stretch_goals ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-lr-text">{score.behaviours_values ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <VisibilityToggle scoreId={score.id} visible={score.visible_to_employee} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/scoring/${score.employee.id}/${score.period_id}`}
                        className="text-xs text-lr-accent hover:underline"
                      >
                        Edit →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function VisibilityToggle({ scoreId, visible }: { scoreId: string; visible: boolean }) {
  return (
    <form action={async (fd: FormData) => {
      'use server'
      const { toggleScoreVisibility } = await import('@/lib/actions/performance-actions')
      await toggleScoreVisibility(fd)
    }}>
      <input type="hidden" name="scoreId" value={scoreId} />
      <input type="hidden" name="visible" value={String(!visible)} />
      <button
        type="submit"
        className={`text-xs rounded-full px-2.5 py-0.5 border transition-colors ${
          visible
            ? 'bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20 hover:bg-lr-cyan/20'
            : 'bg-lr-surface text-lr-muted border-lr-border hover:bg-lr-surface-2'
        }`}
      >
        {visible ? 'Visible' : 'Hidden'}
      </button>
    </form>
  )
}
