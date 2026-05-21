'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, ArrowRight } from 'lucide-react'
import GoalAchievementList from '@/components/checkins/GoalAchievementList'
import MonthlyDoneWellSummary, { type MonthlyReflection } from '@/components/checkins/MonthlyDoneWellSummary'
import ValueChipSelector from '@/components/checkins/ValueChipSelector'
import MitPlanList, { type LinkOption } from '@/components/checkins/MitPlanList'
import { upsertQuarterlyCheckinEmployee } from '@/lib/actions/quarterly-checkin-actions'
import type {
  QuarterlyCheckin,
  CompanyValue,
  QuarterlyGoal,
  QuarterlyGoalReview,
  ValueAssessment,
  PlanMit,
} from '@/lib/types/database'
import { PROBATION_GOAL, PROBATION_MITS } from '@/lib/constants/onboarding'

interface QuarterlyCheckinEmployeeFormProps {
  periodId: string
  checkin: QuarterlyCheckin | null
  companyValues: CompanyValue[]
  monthlyReflections: MonthlyReflection[]
  initialGoals: QuarterlyGoalReview[]
  readOnly?: boolean
  /** True on a new hire's first-ever quarterly check-in — pre-fills the probation goal + MITs. */
  isFirstQuarterly?: boolean
}

function initGoals(checkin: QuarterlyCheckin | null, initialGoals: QuarterlyGoalReview[]): QuarterlyGoalReview[] {
  if (checkin?.goals && checkin.goals.length > 0) return checkin.goals
  return initialGoals
}

function initNextGoals(checkin: QuarterlyCheckin | null, isFirstQuarterly: boolean): QuarterlyGoal[] {
  if (checkin?.next_quarter_goals && checkin.next_quarter_goals.length > 0) return checkin.next_quarter_goals
  // A brand-new hire's first quarterly check-in: pre-fill the probation goal.
  if (isFirstQuarterly) return [{ ...PROBATION_GOAL }]
  return [{ id: crypto.randomUUID(), title: '', description: '' }]
}

function initNextMits(checkin: QuarterlyCheckin | null, isFirstQuarterly: boolean): PlanMit[] {
  if (checkin?.next_quarter_mits && checkin.next_quarter_mits.length > 0) return checkin.next_quarter_mits
  // Pre-fill the hard-coded MITs that tie to the probation goal above.
  if (isFirstQuarterly) return PROBATION_MITS.map((m) => ({ ...m }))
  return [{ title: '', description: '', okr_id: null, okr_label: null }]
}

function initValueAssessments(checkin: QuarterlyCheckin | null): ValueAssessment[] {
  if (checkin?.value_assessments && checkin.value_assessments.length > 0) return checkin.value_assessments
  return []
}

type Step = 'review' | 'plan'

export default function QuarterlyCheckinEmployeeForm({
  periodId, checkin, companyValues, monthlyReflections, initialGoals, readOnly = false, isFirstQuarterly = false,
}: QuarterlyCheckinEmployeeFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [step, setStep] = useState<Step>('review')

  const [goals, setGoals] = useState<QuarterlyGoalReview[]>(() => initGoals(checkin, initialGoals))
  const [valueAssessments, setValueAssessments] = useState<ValueAssessment[]>(() => initValueAssessments(checkin))
  const [nextGoals, setNextGoals] = useState<QuarterlyGoal[]>(() => initNextGoals(checkin, isFirstQuarterly))
  const [nextMits, setNextMits] = useState<PlanMit[]>(() => initNextMits(checkin, isFirstQuarterly))
  const [aiBuilderActive, setAiBuilderActive] = useState<boolean>(checkin?.ai_builder_active ?? false)
  const [aiBuilderDescription, setAiBuilderDescription] = useState<string>(checkin?.ai_builder_description ?? '')

  const goalLinkOptions: LinkOption[] = nextGoals
    .filter((g) => g.title.trim())
    .map((g) => ({ id: g.id, label: g.title }))

  function addNextGoal() {
    setNextGoals((prev) => [...prev, { id: crypto.randomUUID(), title: '', description: '' }])
  }

  function removeNextGoal(index: number) {
    const removed = nextGoals[index]
    setNextGoals((prev) => prev.filter((_, i) => i !== index))
    setNextMits((prev) => prev.map((m) =>
      m.okr_id === removed.id ? { ...m, okr_id: null, okr_label: null } : m
    ))
  }

  function updateNextGoal(index: number, patch: Partial<QuarterlyGoal>) {
    setNextGoals((prev) => prev.map((g, i) => {
      if (i !== index) return g
      const updated = { ...g, ...patch }
      if (patch.title !== undefined) {
        setNextMits((mits) => mits.map((m) =>
          m.okr_id === g.id ? { ...m, okr_label: patch.title! } : m
        ))
      }
      return updated
    }))
  }

  function buildFormData(submit: boolean): FormData {
    const fd = new FormData()
    fd.append('periodId', periodId)
    fd.append('goals', JSON.stringify(goals))
    fd.append('next_quarter_goals', JSON.stringify(nextGoals.filter((g) => g.title.trim())))
    fd.append('next_quarter_mits', JSON.stringify(nextMits.filter((m) => m.title.trim())))
    fd.append('value_assessments', JSON.stringify(valueAssessments))
    fd.append('ai_builder_active', String(aiBuilderActive))
    if (aiBuilderDescription) fd.append('ai_builder_description', aiBuilderDescription)
    if (submit) fd.append('submit', 'true')
    return fd
  }

  function saveAndAdvance() {
    setError(null)
    startTransition(async () => {
      const result = await upsertQuarterlyCheckinEmployee(buildFormData(false))
      if ('error' in result) {
        setError(result.error)
      } else {
        setSavedAt(new Date())
        if (result.id) router.replace(`/quarterly-checkins/${result.id}`)
        setStep('plan')
      }
    })
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await upsertQuarterlyCheckinEmployee(buildFormData(false))
      if ('error' in result) {
        setError(result.error)
      } else {
        setSavedAt(new Date())
        if (result.id) router.replace(`/quarterly-checkins/${result.id}`)
      }
    })
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await upsertQuarterlyCheckinEmployee(buildFormData(true))
      if ('error' in result) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  const tabs: { key: Step; label: string }[] = [
    { key: 'review', label: 'Review' },
    { key: 'plan', label: 'Next Quarter' },
  ]

  return (
    <div className="space-y-6">
      {readOnly && (
        <div className="max-w-3xl rounded-[var(--radius-lr)] border border-lr-accent/20 bg-lr-accent-dim px-4 py-3 text-sm text-lr-accent">
          You submitted this check-in. Editing is locked.
        </div>
      )}

      {/* Tab header */}
      <div className="flex border-b border-lr-border">
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStep(tab.key)}
            className={[
              'flex-1 text-center py-3 text-sm font-semibold transition-colors border-b-2 -mb-px',
              step === tab.key
                ? 'border-lr-accent text-lr-accent'
                : 'border-transparent text-lr-text/50 hover:text-lr-text',
            ].join(' ')}
          >
            <span className="inline-flex items-center gap-2">
              <span className={[
                'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold',
                step === tab.key ? 'bg-lr-accent text-white' : 'bg-lr-border text-lr-text/50',
              ].join(' ')}>{i + 1}</span>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Review tab */}
      {step === 'review' && (
        <div className="space-y-5">
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-5 space-y-6">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-lr-text">Goal Achievements</p>
                <p className="text-xs text-lr-text/50 mt-0.5">Mark each goal as achieved or not</p>
              </div>
              <GoalAchievementList value={goals} onChange={setGoals} disabled={readOnly || isPending} />
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-lr-text">Done Well / Done Differently</p>
                <p className="text-xs text-lr-text/50 mt-0.5">Auto-pulled from your last 3 monthly check-ins</p>
              </div>
              <MonthlyDoneWellSummary reflections={monthlyReflections} />
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-lr-text">Values</p>
                <p className="text-xs text-lr-text/50 mt-0.5">Select the values you demonstrated this quarter and describe how</p>
              </div>
              <ValueChipSelector companyValues={companyValues} value={valueAssessments} onChange={setValueAssessments} disabled={readOnly || isPending} />
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-lr-text">AI Builder</p>
                <p className="text-xs text-lr-text/50 mt-0.5">Did you work on AI-related projects or initiatives this quarter?</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="ai_builder_active"
                    checked={aiBuilderActive}
                    onChange={(e) => setAiBuilderActive(e.target.checked)}
                    disabled={readOnly || isPending}
                    className="h-4 w-4 accent-[#7c5cfc]"
                  />
                  <Label htmlFor="ai_builder_active" className="text-sm text-lr-text cursor-pointer">
                    I worked on AI-related initiatives this quarter
                  </Label>
                </div>
                {aiBuilderActive && (
                  <Textarea
                    value={aiBuilderDescription}
                    onChange={(e) => setAiBuilderDescription(e.target.value)}
                    disabled={readOnly || isPending}
                    placeholder="Describe what you built, used, or contributed using AI…"
                    className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[80px] resize-y"
                  />
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-[var(--radius-lr)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          {!readOnly && (
            <div className="flex justify-end">
              <Button type="button" onClick={saveAndAdvance} disabled={isPending} className="bg-lr-accent hover:bg-lr-accent/90 text-white gap-2">
                {isPending ? 'Saving…' : <>Next Quarter <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Next Quarter tab */}
      {step === 'plan' && (
        <div className="space-y-5">
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-5 space-y-6">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-lr-text">Goals</p>
                <p className="text-xs text-lr-text/50 mt-0.5">What do you want to achieve next quarter?</p>
              </div>
              <div className="space-y-3">
                {nextGoals.map((goal, index) => (
                  <div key={goal.id} className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-caption">Goal</Label>
                          <Input value={goal.title} onChange={(e) => updateNextGoal(index, { title: e.target.value })} disabled={readOnly || isPending} placeholder="What do you want to achieve next quarter?" className="bg-lr-surface border-lr-border text-lr-text text-sm h-9" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-caption">Description</Label>
                          <Textarea value={goal.description} onChange={(e) => updateNextGoal(index, { description: e.target.value })} disabled={readOnly || isPending} placeholder="Brief description or success criteria…" className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[72px] resize-y" />
                        </div>
                      </div>
                      {!readOnly && nextGoals.length > 1 && (
                        <button type="button" onClick={() => removeNextGoal(index)} className="mt-1 text-lr-muted hover:text-lr-error transition-colors flex-shrink-0" aria-label="Remove goal">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!readOnly && (
                  <Button type="button" variant="outline" size="sm" onClick={addNextGoal} className="w-full gap-1.5 border-lr-accent text-lr-accent hover:bg-lr-accent-dim text-xs">
                    <Plus className="h-3.5 w-3.5" /> New goal
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-sm font-semibold text-lr-text">First Month MITs</p>
                <p className="text-xs text-lr-text/50 mt-0.5">These carry over to the review section of your first monthly check-in next quarter.</p>
              </div>
              <MitPlanList value={nextMits} onChange={setNextMits} linkOptions={goalLinkOptions} linkLabel="Quarterly goal" noLinkLabel="Unrelated to quarterly goals" disabled={readOnly || isPending} />
            </div>
          </div>

          {error && (
            <div className="rounded-[var(--radius-lr)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          {!readOnly && (
            <div className="flex items-center gap-3">
              <Button type="button" onClick={save} disabled={isPending} variant="outline" className="border-lr-border text-lr-text hover:bg-lr-surface">
                {isPending ? 'Saving…' : 'Save Draft'}
              </Button>
              <Button type="button" onClick={submit} disabled={isPending} className="bg-lr-accent hover:bg-lr-accent/90 text-white">
                {isPending ? 'Submitting…' : 'Submit Quarterly Review'}
              </Button>
              {savedAt && <span className="text-xs text-lr-muted">Saved {savedAt.toLocaleTimeString()}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
