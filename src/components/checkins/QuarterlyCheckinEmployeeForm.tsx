'use client'

import { useTransition, useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowRight, Plus, Trash2 } from 'lucide-react'
import GoalAchievementList from '@/components/checkins/GoalAchievementList'
import MonthlyDoneWellSummary, { type MonthlyReflection } from '@/components/checkins/MonthlyDoneWellSummary'
import MoodTrendSummary, { type MonthlyMood } from '@/components/checkins/MoodTrendSummary'
import ValueChipSelector from '@/components/checkins/ValueChipSelector'
import MitPlanList, { type LinkOption } from '@/components/checkins/MitPlanList'
import { upsertQuarterlyCheckinEmployee } from '@/lib/actions/quarterly-checkin-actions'
import type {
  QuarterlyCheckin,
  CompanyValue,
  QuarterlyGoalReview,
  QuarterlyGoal,
  ValueAssessment,
  PlanMit,
} from '@/lib/types/database'

interface QuarterlyCheckinEmployeeFormProps {
  periodId: string
  checkin: QuarterlyCheckin | null
  companyValues: CompanyValue[]
  monthlyReflections: MonthlyReflection[]
  monthlyMoods?: MonthlyMood[]
  initialGoals: QuarterlyGoalReview[]
  okrOptions: LinkOption[]
  readOnly?: boolean
}

function initGoals(checkin: QuarterlyCheckin | null, initialGoals: QuarterlyGoalReview[]): QuarterlyGoalReview[] {
  // Prefer the JSONB snapshot (has saved achievement statuses) but fall back to live okrs
  if (checkin?.goals && checkin.goals.length > 0) return checkin.goals as QuarterlyGoalReview[]
  return initialGoals
}

function initNextMits(checkin: QuarterlyCheckin | null): PlanMit[] {
  if (checkin?.next_quarter_mits && checkin.next_quarter_mits.length > 0) return checkin.next_quarter_mits as PlanMit[]
  return [{ title: '', description: '', okr_id: null, okr_label: null }]
}

function initNextGoals(checkin: QuarterlyCheckin | null): QuarterlyGoal[] {
  if (checkin?.next_quarter_goals && (checkin.next_quarter_goals as QuarterlyGoal[]).length > 0)
    return checkin.next_quarter_goals as QuarterlyGoal[]
  return [{ id: crypto.randomUUID(), title: '', description: '' }]
}

function initValueAssessments(checkin: QuarterlyCheckin | null): ValueAssessment[] {
  if (checkin?.value_assessments && checkin.value_assessments.length > 0) return checkin.value_assessments as ValueAssessment[]
  return []
}

type Step = 'review' | 'plan'

export default function QuarterlyCheckinEmployeeForm({
  periodId, checkin, companyValues, monthlyReflections, monthlyMoods = [], initialGoals, okrOptions, readOnly = false,
}: QuarterlyCheckinEmployeeFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [step, setStep] = useState<Step>(() => searchParams.get('step') === 'plan' ? 'plan' : 'review')

  useEffect(() => {
    if (searchParams.get('step')) {
      router.replace(pathname, { scroll: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [goals, setGoals] = useState<QuarterlyGoalReview[]>(() => initGoals(checkin, initialGoals))
  const [valueAssessments, setValueAssessments] = useState<ValueAssessment[]>(() => initValueAssessments(checkin))
  const [nextMits, setNextMits] = useState<PlanMit[]>(() => initNextMits(checkin))
  const [nextGoals, setNextGoals] = useState<QuarterlyGoal[]>(() => initNextGoals(checkin))
  const [aiBuilderActive, setAiBuilderActive] = useState<boolean>(checkin?.ai_builder_active ?? false)
  const [aiBuilderDescription, setAiBuilderDescription] = useState<string>(checkin?.ai_builder_description ?? '')

  function updateNextGoal(id: string, patch: Partial<QuarterlyGoal>) {
    setNextGoals((prev) => prev.map((g) => g.id === id ? { ...g, ...patch } : g))
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
        if (result.id) router.replace(`/quarterly-checkins/${result.id}?step=plan`)
        else setStep('plan')
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
        <div className="rounded-[var(--radius-lr)] border border-lr-accent/20 bg-lr-accent-dim px-4 py-3 text-sm text-lr-accent">
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
              {goals.length === 0 ? (
                <p className="text-xs text-lr-muted/60 italic">No goals set for this quarter. Add goals in the Goals tab first.</p>
              ) : (
                <GoalAchievementList value={goals} onChange={setGoals} disabled={readOnly || isPending} />
              )}
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
                <p className="text-sm font-semibold text-lr-text">Monthly Pulse</p>
                <p className="text-xs text-lr-text/50 mt-0.5">Your energy and productivity across the quarter</p>
              </div>
              <MoodTrendSummary moods={monthlyMoods} />
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
                  <label htmlFor="ai_builder_active" className="text-sm text-lr-text cursor-pointer">
                    I worked on AI-related initiatives this quarter
                  </label>
                </div>
                {aiBuilderActive && (
                  <textarea
                    value={aiBuilderDescription}
                    onChange={(e) => setAiBuilderDescription(e.target.value)}
                    disabled={readOnly || isPending}
                    placeholder="Describe what you built, used, or contributed using AI…"
                    className="w-full bg-lr-surface border border-lr-border text-lr-text text-sm rounded-[var(--radius-lr)] px-3 py-2 min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-lr-accent/50"
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
          {/* Goals for next quarter */}
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-lr-text">Goals for Next Quarter</p>
              <p className="text-xs text-lr-text/50 mt-0.5">Set your quarterly goals. These will appear in your dashboard under My Goals.</p>
            </div>
            <div className="space-y-3">
              {nextGoals.map((goal) => (
                <div key={goal.id} className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="space-y-1">
                        <Label className="text-caption">Goal title</Label>
                        <Input
                          value={goal.title}
                          onChange={(e) => updateNextGoal(goal.id, { title: e.target.value })}
                          disabled={readOnly || isPending}
                          placeholder="What do you want to achieve next quarter?"
                          className="bg-lr-surface border-lr-border text-lr-text text-sm h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-caption">Description</Label>
                        <Textarea
                          value={goal.description}
                          onChange={(e) => updateNextGoal(goal.id, { description: e.target.value })}
                          disabled={readOnly || isPending}
                          placeholder="How will you know you've achieved it?"
                          className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[60px] resize-y"
                        />
                      </div>
                    </div>
                    {!readOnly && nextGoals.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setNextGoals((prev) => prev.filter((g) => g.id !== goal.id))}
                        className="text-lr-muted hover:text-lr-error transition-colors mt-1"
                        aria-label="Remove goal"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNextGoals((prev) => [...prev, { id: crypto.randomUUID(), title: '', description: '' }])}
                  disabled={isPending}
                  className="w-full gap-1.5 border-lr-accent text-lr-accent hover:bg-lr-accent-dim text-xs"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Goal
                </Button>
              )}
            </div>
          </div>

          {/* MITs for first month */}
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-lr-text">First Month MITs</p>
              <p className="text-xs text-lr-text/50 mt-0.5">Plan your first MITs for next quarter. These carry over to your first monthly check-in.</p>
            </div>
            <MitPlanList
              value={nextMits}
              onChange={setNextMits}
              linkOptions={nextGoals.filter((g) => g.title.trim()).map((g) => ({ id: g.id, label: g.title }))}
              linkLabel="Next quarter goal"
              noLinkLabel="Unrelated to next quarter goals"
              disabled={readOnly || isPending}
            />
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
