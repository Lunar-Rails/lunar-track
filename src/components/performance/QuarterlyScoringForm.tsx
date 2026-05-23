'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { upsertQuarterlyScore } from '@/lib/actions/performance-actions'
import { SCORE_LABELS } from '@/lib/constants/scores'
import type {
  Checkin,
  CompanyValue,
  Initiative,
  KeyResult,
  Okr,
  QuarterlyCheckin,
  QuarterlyScore,
  ValueAssessment,
  ValueSelfAssessment,
} from '@/lib/types/database'


const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

type OkrWithProgress = Okr & {
  key_results: (KeyResult & { initiatives: Initiative[] })[]
}

interface QuarterlyGoalReview {
  id: string
  title?: string | null
  description?: string | null
  status: 'achieved' | 'not_achieved' | null
}

interface ReviewMit {
  title: string
  okr_id?: string | null
  status?: 'achieved' | 'not_achieved' | null
}

interface QuarterlyScoringFormProps {
  employeeId: string
  periodId: string
  periodName: string
  employeeName: string
  okrsWithProgress: OkrWithProgress[]
  checkins: Checkin[]
  existing: QuarterlyScore | null
  companyValues: CompanyValue[]
  employeeQuarterlyCheckin: QuarterlyCheckin | null
}

function ScoreColumn({
  title,
  subtitle,
  children,
  score,
  onScoreChange,
  notes,
  onNotesChange,
  notesPlaceholder,
  disabled,
  aiBuilderLocked = false,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  score: number
  onScoreChange: (v: number) => void
  notes: string
  onNotesChange: (v: string) => void
  notesPlaceholder: string
  disabled: boolean
  aiBuilderLocked?: boolean
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5">
      <div>
        <h3 className="text-card-title">{title}</h3>
        <p className="text-xs text-lr-muted mt-0.5">{subtitle}</p>
      </div>

      {/* Context */}
      <div className="flex-1 space-y-2 min-h-[120px]">
        {children}
      </div>

      {/* Manager notes */}
      <div className="space-y-1">
        <Label className="text-caption">Manager notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          disabled={disabled}
          placeholder={notesPlaceholder}
          className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[80px] resize-y"
        />
      </div>

      {/* Score */}
      <div className="space-y-2">
        <Label className="text-caption">Score</Label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const locked = aiBuilderLocked && n < 4
            return (
              <button
                key={n}
                type="button"
                disabled={disabled || locked}
                onClick={() => onScoreChange(n)}
                title={locked ? 'Scores 1–3 require AI Builder to be confirmed' : undefined}
                className={`flex-1 rounded-[var(--radius-lr)] border py-2.5 text-sm font-bold transition-colors ${
                  score === n
                    ? 'border-lr-accent bg-lr-accent-dim text-lr-accent'
                    : locked
                    ? 'border-lr-border/30 bg-lr-surface/30 text-lr-muted/30 cursor-not-allowed'
                    : 'border-lr-border bg-lr-surface text-lr-muted hover:bg-lr-surface-2'
                }`}
              >
                {n}
              </button>
            )
          })}
        </div>
        {aiBuilderLocked && (
          <p className="text-xs text-lr-gold">
            ⚠ Scores 1–3 locked — confirm AI Builder above to unlock.
          </p>
        )}
        <p className="text-xs text-lr-accent font-medium">
          {score} — {SCORE_LABELS[score]}
        </p>
      </div>
    </div>
  )
}

export default function QuarterlyScoringForm({
  employeeId,
  periodId,
  periodName,
  employeeName,
  okrsWithProgress,
  checkins,
  existing,
  companyValues,
  employeeQuarterlyCheckin,
}: QuarterlyScoringFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [professionalMastery, setProfessionalMastery] = useState<number>(existing?.professional_mastery ?? 3)
  const [okrsStretch, setOkrsStretch] = useState<number>(existing?.okrs_stretch_goals ?? 3)
  const [behavioursValues, setBehavioursValues] = useState<number>(existing?.behaviours_values ?? 3)
  const [pmNotes, setPmNotes] = useState(existing?.professional_mastery_notes ?? '')
  const [okrNotes, setOkrNotes] = useState(existing?.okrs_stretch_goals_notes ?? '')
  const [bvNotes, setBvNotes] = useState(existing?.behaviours_values_notes ?? '')
  const employeeReportedAiBuilder = employeeQuarterlyCheckin?.ai_builder_active ?? false
  const [aiBuilderActive, setAiBuilderActive] = useState<boolean>(employeeReportedAiBuilder)

  function handleAiBuilderChange(checked: boolean) {
    setAiBuilderActive(checked)
    // Auto-set BV to 4 if manager unchecks and score is currently 1, 2, or 3
    if (!checked && behavioursValues < 4) setBehavioursValues(4)
  }

  function handleBvScoreChange(v: number) {
    if (!aiBuilderActive && v < 4) return // block 1, 2, 3 without AI Builder
    setBehavioursValues(v)
  }

  function onSave() {
    setError(null)
    setSaved(false)
    if (!aiBuilderActive && behavioursValues < 4) {
      setError('Behaviours/Values score cannot be 1–3 without AI Builder confirmed by the manager.')
      return
    }
    startTransition(async () => {
      const fd = new FormData()
      fd.append('employeeId', employeeId)
      fd.append('periodId', periodId)
      fd.append('professional_mastery', String(professionalMastery))
      fd.append('okrs_stretch_goals', String(okrsStretch))
      fd.append('behaviours_values', String(behavioursValues))
      if (pmNotes) fd.append('professional_mastery_notes', pmNotes)
      if (okrNotes) fd.append('okrs_stretch_goals_notes', okrNotes)
      if (bvNotes) fd.append('behaviours_values_notes', bvNotes)
      fd.append('ai_builder_active', String(aiBuilderActive))
      fd.append('value_ratings', JSON.stringify([]))
      const result = await upsertQuarterlyScore(fd)
      if ('error' in result) setError(result.error)
      else {
        setSaved(true)
        router.refresh()
      }
    })
  }

  const submittedCheckins = checkins.filter((c) => c.employee_submitted_at)
  const qGoals = (employeeQuarterlyCheckin?.goals as QuarterlyGoalReview[] | null | undefined) ?? []
  const valueAssessments = (employeeQuarterlyCheckin?.value_assessments as ValueAssessment[] | null | undefined) ?? []
  const valueSelfAssessments = (employeeQuarterlyCheckin?.value_self_assessments as ValueSelfAssessment[] | null | undefined) ?? []
  const empAiDescription = employeeQuarterlyCheckin?.ai_builder_description

  return (
    <div className="space-y-6">
      {/* AI Builder toggle */}
      <div className={`flex items-start gap-3 rounded-[var(--radius-lr-lg)] border p-4 transition-colors ${
        aiBuilderActive ? 'border-lr-accent/30 bg-lr-accent-dim' : 'border-lr-border bg-lr-surface'
      }`}>
        <Checkbox
          id="ai_builder_active"
          checked={aiBuilderActive}
          onCheckedChange={(checked) => handleAiBuilderChange(checked === true)}
          disabled={isPending}
          className="mt-0.5"
        />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Label htmlFor="ai_builder_active" className="text-sm text-lr-text font-medium cursor-pointer">
              AI Builder active this quarter
            </Label>
            {employeeReportedAiBuilder && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-lr-accent/20 text-lr-accent border border-lr-accent/30">
                Employee self-reported ✓
              </span>
            )}
            {!employeeReportedAiBuilder && employeeQuarterlyCheckin && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-lr-border/50 text-lr-muted border border-lr-border">
                Not reported by employee
              </span>
            )}
          </div>
          {!aiBuilderActive && (
            <p className="text-xs text-lr-gold">
              Behaviours/Values score is capped at 4 — check this box to unlock score 5.
            </p>
          )}
          {aiBuilderActive && empAiDescription && (
            <p className="text-xs text-lr-cyan italic">&ldquo;{empAiDescription}&rdquo;</p>
          )}
          {aiBuilderActive && !empAiDescription && (
            <p className="text-xs text-lr-muted">Score 5 is unlocked for Behaviours/Values.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Professional Mastery */}
        <ScoreColumn
          title="Professional Mastery"
          subtitle="Technical skills, domain knowledge, craft quality"
          score={professionalMastery}
          onScoreChange={setProfessionalMastery}
          notes={pmNotes}
          onNotesChange={setPmNotes}
          notesPlaceholder="Notes on Professional Mastery…"
          disabled={isPending}
        >
          {submittedCheckins.length > 0 ? (
            <div className="space-y-3">
              {submittedCheckins.map((c) => {
                const mits = (c.mits as ReviewMit[] | null ?? []).filter((m) => m.title?.trim())
                const doneWell = (c.done_well as string | null)?.trim()
                if (!mits.length && !doneWell) return null
                return (
                  <div key={c.id} className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-lr-muted uppercase tracking-wide">
                      {MONTH_NAMES[c.month - 1]}
                    </p>
                    {mits.map((mit, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className={`mt-[3px] h-1.5 w-1.5 rounded-full shrink-0 ${
                          mit.status === 'achieved' ? 'bg-lr-success' : 'bg-lr-error/70'
                        }`} />
                        <p className="text-xs text-lr-text leading-snug">{mit.title}</p>
                      </div>
                    ))}
                    {doneWell && (
                      <p className="text-xs text-lr-muted italic leading-snug">&ldquo;{doneWell}&rdquo;</p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-lr-muted/60 italic">No submitted check-ins yet</p>
          )}
        </ScoreColumn>

        {/* Goals */}
        <ScoreColumn
          title="Goals"
          subtitle="Progress on committed goals and stretch objectives"
          score={okrsStretch}
          onScoreChange={setOkrsStretch}
          notes={okrNotes}
          onNotesChange={setOkrNotes}
          notesPlaceholder="Notes on Goals…"
          disabled={isPending}
        >
          {okrsWithProgress.length > 0 ? (
            <div className="space-y-3">
              {okrsWithProgress.map((okr) => {
                const allInits = okr.key_results.flatMap((kr) => kr.initiatives)
                const done = allInits.filter((i) => i.completed).length
                const pct = allInits.length > 0 ? Math.round((done / allInits.length) * 100) : 0
                const qGoal = qGoals.find((g) => g.id === okr.id)
                return (
                  <div key={okr.id} className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-lr-text leading-snug flex-1">{okr.title}</p>
                      {qGoal?.status && (
                        <span className={`text-[10px] font-semibold shrink-0 ${
                          qGoal.status === 'achieved' ? 'text-lr-success' : 'text-lr-error'
                        }`}>
                          {qGoal.status === 'achieved' ? 'Achieved' : 'Not achieved'}
                        </span>
                      )}
                    </div>
                    {allInits.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-lr-surface overflow-hidden">
                          <div className="h-full bg-lr-accent" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-lr-muted shrink-0">{done}/{allInits.length}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-lr-muted/60 italic">No goals set for this period</p>
          )}
        </ScoreColumn>

        {/* Behaviours & Values */}
        <ScoreColumn
          title="Behaviours & Values"
          subtitle="Alignment with BCOMM company values"
          score={behavioursValues}
          onScoreChange={handleBvScoreChange}
          aiBuilderLocked={!aiBuilderActive}
          notes={bvNotes}
          onNotesChange={setBvNotes}
          notesPlaceholder="Notes on Behaviours & Values…"
          disabled={isPending}
        >
          {valueAssessments.length > 0 ? (
            <div className="space-y-2.5">
              {valueAssessments.map((va, i) => (
                <div key={i} className="space-y-0.5">
                  <p className="text-xs font-medium text-lr-text">{va.value_name}</p>
                  {va.description && (
                    <p className="text-xs text-lr-muted italic leading-snug">{va.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : valueSelfAssessments.length > 0 ? (
            <div className="space-y-2.5">
              {valueSelfAssessments.map((sa) => {
                const cv = companyValues.find((v) => v.id === sa.value_id)
                return (
                  <div key={sa.value_id} className="space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-lr-text">{cv?.name ?? sa.value_id}</p>
                      <span className="text-xs text-lr-accent font-bold shrink-0">{sa.rating}/5</span>
                    </div>
                    {sa.examples && (
                      <p className="text-xs text-lr-muted italic leading-snug">{sa.examples}</p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-lr-muted/60 italic">
              {employeeQuarterlyCheckin
                ? 'No values cited in the quarterly review.'
                : 'Employee has not submitted a quarterly review yet.'}
            </p>
          )}
        </ScoreColumn>
      </div>

      {error && (
        <div className="rounded-[var(--radius-lr)] border border-lr-error/20 bg-lr-error-dim px-4 py-3 text-sm text-lr-error">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={onSave}
          disabled={isPending}
          className="bg-lr-accent hover:bg-lr-accent/90 text-white"
        >
          {isPending ? 'Saving…' : existing ? 'Update Score' : 'Save Score'}
        </Button>
        {saved && <span className="text-xs text-lr-cyan">Saved successfully — for {employeeName}</span>}
      </div>
    </div>
  )
}
