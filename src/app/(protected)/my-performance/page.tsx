import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { PerformancePeriod, QuarterlyScore } from '@/lib/types/database'
import { SCORE_LABELS } from '@/lib/constants/scores'

export const metadata: Metadata = { title: 'My Performance · LunarTrack' }

export const dynamic = 'force-dynamic'

type ScoreWithPeriod = QuarterlyScore & {
  period: Pick<PerformancePeriod, 'id' | 'name' | 'quarter' | 'year'>
}

export default async function MyPerformancePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: scoresRaw } = await (supabase as any)
    .from('quarterly_scores')
    .select('*, period:performance_periods!period_id(id,name,quarter,year)')
    .eq('employee_id', user.id)
    .eq('visible_to_employee', true)
    .order('year', { ascending: false, referencedTable: 'performance_periods' })
    .order('quarter', { ascending: false, referencedTable: 'performance_periods' })

  const scores = (scoresRaw ?? []) as ScoreWithPeriod[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">My Performance</h1>
        <p className="text-body text-lr-muted mt-1">
          Quarterly scores shared by your manager
        </p>
      </div>

      {scores.length === 0 ? (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-12 text-center">
          <p className="text-body text-lr-muted">
            Your manager hasn&apos;t shared any scores yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {scores.map((score) => (
            <div
              key={score.id}
              className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-lr-text">
                  {score.period.name}
                </h2>
                <span className="inline-flex items-center rounded-full border border-lr-border bg-lr-surface px-2.5 py-0.5 text-xs font-medium text-lr-accent">
                  Q{score.period.quarter} {score.period.year}
                </span>
              </div>

              <div className="space-y-3">
                <ScoreRow
                  label="Professional Mastery"
                  value={score.professional_mastery}
                  notes={score.professional_mastery_notes}
                />
                <ScoreRow
                  label="Goals"
                  value={score.okrs_stretch_goals}
                  notes={score.okrs_stretch_goals_notes}
                />
                <ScoreRow
                  label="Behaviours & Values"
                  value={score.behaviours_values}
                  notes={score.behaviours_values_notes}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScoreRow({
  label,
  value,
  notes,
}: {
  label: string
  value: number | null
  notes: string | null
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        {value !== null ? (
          <span
            className="text-3xl font-bold text-lr-accent leading-none"
            title={SCORE_LABELS[value] ?? String(value)}
          >
            {value}
          </span>
        ) : (
          <span className="text-3xl font-bold text-lr-muted leading-none">—</span>
        )}
        <div>
          <p className="text-sm font-medium text-lr-text">{label}</p>
          {value !== null && (
            <p className="text-xs text-lr-muted">{SCORE_LABELS[value]}</p>
          )}
        </div>
      </div>
      {notes && (
        <p className="text-xs text-lr-muted pl-10">{notes}</p>
      )}
    </div>
  )
}
