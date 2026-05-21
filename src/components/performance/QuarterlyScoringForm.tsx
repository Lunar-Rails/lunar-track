'use client'

import { useTransition, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { upsertQuarterlyScore } from '@/lib/actions/performance-actions'
import type {
  Checkin,
  CompanyValue,
  Okr,
  QuarterlyCheckin,
  QuarterlyScore,
  ValueRating,
  ValueSelfAssessment,
} from '@/lib/types/database'

const SCORE_LABELS: Record<number, string> = {
  1: 'Significantly below expectations',
  2: 'Below expectations',
  3: 'Meets expectations',
  4: 'Exceeds expectations',
  5: 'Outstanding',
}

interface QuarterlyScoringFormProps {
  employeeId: string
  periodId: string
  periodName: string
  employeeName: string
  okrs: Okr[]
  checkins: Checkin[]
  existing: QuarterlyScore | null
  companyValues: CompanyValue[]
  employeeQuarterlyCheckin: QuarterlyCheckin | null
}

function ScoreSelector({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  disabled: boolean
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          title={SCORE_LABELS[n]}
          className={`flex flex-col items-center rounded-[var(--radius-lr-lg)] border px-4 py-2.5 transition-colors min-w-[56px] ${
            value === n
              ? 'border-lr-accent bg-lr-accent-dim text-lr-accent'
              : 'border-lr-border bg-lr-surface text-lr-muted hover:bg-lr-surface-2'
          }`}
        >
          <span className="text-lg font-bold">{n}</span>
        </button>
      ))}
    </div>
  )
}

function CompactScoreSelector({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  disabled: boolean
}) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          title={SCORE_LABELS[n]}
          className={`h-9 w-9 rounded-md border text-sm font-bold transition-colors ${
            value === n
              ? 'border-lr-accent bg-lr-accent-dim text-lr-accent'
              : 'border-lr-border bg-lr-surface text-lr-muted hover:bg-lr-surface-2'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function buildInitialValueRatings(
  values: CompanyValue[],
  existing: ValueRating[]
): ValueRating[] {
  return values.map((v) => {
    const found = existing.find((x) => x.value_id === v.id)
    return found ?? { value_id: v.id, value_name: v.name, rating: 3, evidence: '' }
  })
}

export default function QuarterlyScoringForm({
  employeeId,
  periodId,
  periodName,
  employeeName,
  okrs,
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
  const [pmNotes, setPmNotes] = useState(existing?.professional_mastery_notes ?? '')
  const [okrNotes, setOkrNotes] = useState(existing?.okrs_stretch_goals_notes ?? '')
  const [bvNotes, setBvNotes] = useState(existing?.behaviours_values_notes ?? '')
  const [aiBuilderActive, setAiBuilderActive] = useState<boolean>(false)

  const [valueRatings, setValueRatings] = useState<ValueRating[]>(() =>
    buildInitialValueRatings(companyValues, existing?.value_ratings ?? [])
  )

  const selfAssessmentMap = useMemo(() => {
    const map = new Map<string, ValueSelfAssessment>()
    for (const sa of employeeQuarterlyCheckin?.value_self_assessments ?? []) {
      map.set(sa.value_id, sa)
    }
    return map
  }, [employeeQuarterlyCheckin])

  const behavioursAvg = useMemo(() => {
    if (valueRatings.length === 0) return 3
    const sum = valueRatings.reduce((acc, v) => acc + v.rating, 0)
    return Math.round(sum / valueRatings.length)
  }, [valueRatings])

  function updateValueRating(valueId: string, patch: Partial<ValueRating>) {
    setValueRatings((prev) =>
      prev.map((v) => (v.value_id === valueId ? { ...v, ...patch } : v))
    )
  }

  function onSave() {
    setError(null)
    setSaved(false)

    if (!aiBuilderActive && behavioursAvg > 4) {
      setError('Behaviours/Values average cannot exceed 4 when AI Builder is not active this quarter.')
      return
    }

    startTransition(async () => {
      const fd = new FormData()
      fd.append('employeeId', employeeId)
      fd.append('periodId', periodId)
      fd.append('professional_mastery', String(professionalMastery))
      fd.append('okrs_stretch_goals', String(okrsStretch))
      fd.append('behaviours_values', String(behavioursAvg))
      if (pmNotes) fd.append('professional_mastery_notes', pmNotes)
      if (okrNotes) fd.append('okrs_stretch_goals_notes', okrNotes)
      if (bvNotes) fd.append('behaviours_values_notes', bvNotes)
      fd.append('ai_builder_active', String(aiBuilderActive))
      fd.append('value_ratings', JSON.stringify(valueRatings))

      const result = await upsertQuarterlyScore(fd)
      if ('error' in result) setError(result.error)
      else {
        setSaved(true)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Context panel */}
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 space-y-4">
        <h3 className="text-card-title">Context: {periodName}</h3>

        {okrs.length > 0 && (
          <div>
            <p className="text-section-label mb-2">Goals</p>
            <ul className="space-y-1">
              {okrs.map((okr) => (
                <li key={okr.id} className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${okr.status === 'APPROVED' ? 'bg-lr-cyan' : 'bg-lr-muted'}`} />
                  <span className="text-sm text-lr-text">{okr.title}</span>
                  <span className="text-xs text-lr-muted ml-auto">{okr.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {checkins.length > 0 && (
          <div>
            <p className="text-section-label mb-2">Check-ins this quarter</p>
            <div className="flex flex-wrap gap-2">
              {checkins.map((c) => (
                <span
                  key={c.id}
                  className={`text-xs rounded-[var(--radius-lr)] border px-2 py-1 ${
                    c.manager_submitted_at
                      ? 'bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20'
                      : c.employee_submitted_at
                      ? 'bg-lr-gold-dim text-lr-gold border-lr-gold/20'
                      : 'bg-lr-surface text-lr-muted border-lr-border'
                  }`}
                >
                  {MONTH_NAMES[c.month - 1]}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* AI Builder override toggle */}
      <div className="flex items-start gap-3 rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4">
        <input
          type="checkbox"
          id="ai_builder_active"
          checked={aiBuilderActive}
          onChange={(e) => setAiBuilderActive(e.target.checked)}
          disabled={isPending}
          className="mt-0.5 h-4 w-4 accent-[#7c5cfc]"
        />
        <div>
          <Label htmlFor="ai_builder_active" className="text-sm text-lr-text font-medium cursor-pointer">
            AI Builder active this quarter
          </Label>
          {!aiBuilderActive && (
            <p className="text-xs text-lr-gold mt-0.5">
              Note: Behaviours/Values average cannot exceed 4 without an active AI Builder project.
            </p>
          )}
        </div>
      </div>

      {/* Professional Mastery */}
      <section className="space-y-3">
        <div>
          <h3 className="text-card-title">Professional Mastery</h3>
          <p className="text-xs text-lr-muted mt-0.5">Technical skills, domain knowledge, craft quality</p>
        </div>
        <ScoreSelector value={professionalMastery} onChange={setProfessionalMastery} disabled={isPending} />
        <div className="space-y-1">
          <Label className="text-caption">Notes (optional)</Label>
          <Textarea
            value={pmNotes}
            onChange={(e) => setPmNotes(e.target.value)}
            disabled={isPending}
            placeholder="Notes on Professional Mastery…"
            className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[80px] resize-y"
          />
        </div>
      </section>

      {/* OKRs / Stretch Goals */}
      <section className="space-y-3">
        <div>
          <h3 className="text-card-title">Goals / Stretch Goals</h3>
          <p className="text-xs text-lr-muted mt-0.5">Progress on committed Goals and stretch objectives</p>
        </div>
        <ScoreSelector value={okrsStretch} onChange={setOkrsStretch} disabled={isPending} />
        <div className="space-y-1">
          <Label className="text-caption">Notes (optional)</Label>
          <Textarea
            value={okrNotes}
            onChange={(e) => setOkrNotes(e.target.value)}
            disabled={isPending}
            placeholder="Notes on Goals / Stretch Goals…"
            className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[80px] resize-y"
          />
        </div>
      </section>

      {/* Behaviours / Values per-value scoring */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-card-title">Behaviours &amp; Values</h3>
            <p className="text-xs text-lr-muted mt-0.5">
              Rate each BCOMM company value individually. The aggregate behaviours score is the rounded average.
            </p>
            {!aiBuilderActive && (
              <p className="text-xs text-lr-gold mt-1">AI Builder not active — aggregate score cannot exceed 4.</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-caption text-lr-muted">Aggregate</p>
            <p className="text-3xl font-bold text-lr-accent leading-none">{behavioursAvg}</p>
            <p className="text-[10px] text-lr-muted">/ 5</p>
          </div>
        </div>

        <div className="space-y-3">
          {valueRatings.map((vr) => {
            const meta = companyValues.find((cv) => cv.id === vr.value_id)
            const selfAssessment = selfAssessmentMap.get(vr.value_id)
            return (
              <div
                key={vr.value_id}
                className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-lr-text">{vr.value_name}</p>
                    {meta?.description && (
                      <p className="text-xs text-lr-muted mt-0.5">{meta.description}</p>
                    )}
                  </div>
                  <CompactScoreSelector
                    value={vr.rating}
                    onChange={(n) => updateValueRating(vr.value_id, { rating: n })}
                    disabled={isPending}
                  />
                </div>

                {selfAssessment && (
                  <div className="rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface p-3 space-y-1">
                    <p className="text-caption text-lr-muted">
                      Employee self-rating: <span className="text-lr-accent font-medium">{selfAssessment.rating}/5</span>
                    </p>
                    {selfAssessment.examples && (
                      <p className="text-xs text-lr-muted whitespace-pre-wrap">{selfAssessment.examples}</p>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-caption">Evidence (optional)</Label>
                  <Textarea
                    value={vr.evidence}
                    onChange={(e) => updateValueRating(vr.value_id, { evidence: e.target.value })}
                    disabled={isPending}
                    placeholder={`Specific moments where ${vr.value_name} was demonstrated…`}
                    className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[60px] resize-y"
                  />
                </div>
              </div>
            )
          })}
        </div>

        <div className="space-y-1">
          <Label className="text-caption">Overall behaviours notes (optional)</Label>
          <Textarea
            value={bvNotes}
            onChange={(e) => setBvNotes(e.target.value)}
            disabled={isPending}
            placeholder="Cross-cutting observations on behaviours / values…"
            className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[80px] resize-y"
          />
        </div>
      </section>

      {error && (
        <div className="rounded-[var(--radius-lr)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
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
