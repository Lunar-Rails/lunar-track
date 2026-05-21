'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckSquare, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { Plus, ChevronDown } from 'lucide-react'
import {
  KrStatusPill,
  KrStatusSelect,
  InitiativeCheckbox,
} from '@/components/okrs/OkrProgressControls'
import { upsertQuarterlyCheckinEmployee } from '@/lib/actions/quarterly-checkin-actions'
import type {
  CompanyValue,
  QuarterlyCheckin,
  QuarterlyCheckinOkrProgress,
  ValueSelfAssessment,
  Okr,
  KeyResult,
  Initiative,
} from '@/lib/types/database'

type OkrWithHierarchy = Okr & {
  key_results: (KeyResult & { initiatives: Initiative[] })[]
}

interface Props {
  periodId: string
  checkin: QuarterlyCheckin | null
  employeeOkrs: OkrWithHierarchy[]   // approved only — used for progress section
  allOkrs?: OkrWithHierarchy[]       // all statuses — used for summary section
  companyValues: CompanyValue[]
  readOnly: boolean
}

const VALUE_SCORE_HINTS: Record<number, string> = {
  1: 'Rarely demonstrated',
  2: 'Occasionally demonstrated',
  3: 'Consistently demonstrated',
  4: 'Strongly demonstrated',
  5: 'Exemplary',
}

function getInitialValueAssessments(
  values: CompanyValue[],
  existing: ValueSelfAssessment[]
): ValueSelfAssessment[] {
  return values.map((v) => {
    const found = existing.find((x) => x.value_id === v.id)
    return found ?? { value_id: v.id, value_name: v.name, rating: 3, examples: '' }
  })
}

/**
 * Narrative-only progress entries. Live progress data (KR status, initiative completion)
 * comes from the OKR records themselves, not the check-in.
 */
function getInitialOkrNarratives(
  okrs: OkrWithHierarchy[],
  existing: QuarterlyCheckinOkrProgress[]
): QuarterlyCheckinOkrProgress[] {
  return okrs.map((okr) => {
    const found = existing.find((p) => p.okr_id === okr.id)
    return {
      okr_id: okr.id,
      okr_title: okr.title,
      narrative: found?.narrative ?? '',
    }
  })
}

function computeOkrProgress(okr: OkrWithHierarchy) {
  const initiatives = okr.key_results.flatMap((kr) => kr.initiatives)
  const total = initiatives.length
  const done = initiatives.filter((i) => i.completed).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return { total, done, pct }
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT:              'bg-lr-surface text-lr-muted border-lr-border',
  PENDING_REVIEW:     'bg-lr-gold-dim text-lr-gold border-lr-gold/20',
  APPROVED:           'bg-lr-success-dim text-lr-success border-lr-success/20',
  REVISION_REQUESTED: 'bg-lr-error-dim text-lr-error border-lr-error/20',
}

export default function QuarterlyCheckinEmployeeForm({
  periodId,
  checkin,
  employeeOkrs,
  allOkrs,
  companyValues,
  readOnly,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  // Narrative-only state; KR statuses and initiative checkboxes manage themselves
  // via their own server actions (KrStatusSelect / InitiativeCheckbox).
  const [okrNarratives, setOkrNarratives] = useState<QuarterlyCheckinOkrProgress[]>(() =>
    getInitialOkrNarratives(employeeOkrs, checkin?.okr_progress ?? [])
  )

  const [valueAssessments, setValueAssessments] = useState<ValueSelfAssessment[]>(() =>
    getInitialValueAssessments(companyValues, checkin?.value_self_assessments ?? [])
  )

  // Which values the employee has chosen to write about
  const [selectedValueIds, setSelectedValueIds] = useState<Set<string>>(() => {
    const existing = checkin?.value_self_assessments ?? []
    if (existing.length > 0) {
      return new Set(existing.filter(v => v.examples || v.rating !== 3).map(v => v.value_id))
    }
    return new Set()
  })

  function toggleValue(valueId: string) {
    setSelectedValueIds(prev => {
      const next = new Set(prev)
      if (next.has(valueId)) { next.delete(valueId) } else { next.add(valueId) }
      return next
    })
  }

  const [continueDoing, setContinueDoing] = useState(checkin?.continue_doing ?? '')
  const [stopDoing, setStopDoing] = useState(checkin?.stop_doing ?? '')
  const [startDoing, setStartDoing] = useState(checkin?.start_doing ?? '')
  const [capabilityNeeds, setCapabilityNeeds] = useState(checkin?.capability_needs ?? '')

  function updateValueRating(valueId: string, rating: number) {
    setValueAssessments((prev) => prev.map((v) => v.value_id === valueId ? { ...v, rating } : v))
  }
  function updateValueExamples(valueId: string, examples: string) {
    setValueAssessments((prev) => prev.map((v) => v.value_id === valueId ? { ...v, examples } : v))
  }

  function updateOkrNarrative(index: number, narrative: string) {
    setOkrNarratives((prev) => prev.map((item, i) => i === index ? { ...item, narrative } : item))
  }

  function buildFormData(submit: boolean): FormData {
    const fd = new FormData()
    fd.append('periodId', periodId)
    fd.append('okr_progress', JSON.stringify(okrNarratives))
    fd.append('value_self_assessments', JSON.stringify(valueAssessments.filter(v => selectedValueIds.has(v.value_id))))
    if (continueDoing) fd.append('continue_doing', continueDoing)
    if (stopDoing) fd.append('stop_doing', stopDoing)
    if (startDoing) fd.append('start_doing', startDoing)
    if (capabilityNeeds) fd.append('capability_needs', capabilityNeeds)
    if (submit) fd.append('submit', 'true')
    return fd
  }

  function onSave() {
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

  function onSubmit() {
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

  const isSubmitted = !!checkin?.employee_submitted_at
  const disabled = readOnly || isPending
  // The OKR owner can edit live progress only while the check-in is not yet submitted.
  // After submission the check-in is a snapshot — we render progress read-only.
  const canEditLiveProgress = !readOnly && !isSubmitted

  return (
    <div className="space-y-8">
      {isSubmitted && (
        <div className="rounded-[var(--radius-lr)] border border-lr-accent/20 bg-lr-accent-dim px-4 py-3 text-sm text-lr-accent">
          You submitted this quarterly check-in. Editing is locked.
        </div>
      )}

      {/* Section 0 — OKR / Deliverables / Goals */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-card-title">OKR / Deliverables / Goals</h3>
            <p className="text-xs text-lr-muted mt-0.5">Your objectives, deliverables and goals for this quarter.</p>
          </div>
          {!readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 border-lr-accent text-lr-accent hover:bg-lr-accent-dim text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add
                  <ChevronDown className="h-3 w-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-lr-surface border-lr-border shadow-[var(--shadow-lr-card)] p-1.5">
                {[
                  { label: 'OKR', description: 'Objective with Key Results & Initiatives' },
                  { label: 'Deliverable', description: 'Concrete output or project commitment' },
                  { label: 'Goal', description: 'Personal or professional development goal' },
                ].map(({ label, description }) => (
                  <DropdownMenuItem
                    key={label}
                    className="flex flex-col items-start gap-0.5 cursor-pointer py-2.5 px-3 rounded-[var(--radius-lr)] text-lr-text focus:bg-lr-accent-dim focus:text-lr-accent"
                    onClick={() => router.push(`/okrs/new?type=${encodeURIComponent(label)}`)}
                  >
                    <span className="font-semibold text-sm text-lr-text">+ {label}</span>
                    <span className="text-xs text-lr-muted">{description}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {(allOkrs ?? []).length === 0 ? (
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 text-center">
            <p className="text-sm text-lr-muted">No OKRs / Deliverables / Goals set for this period.</p>
            {!readOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-3 gap-1.5 border-lr-accent text-lr-accent hover:bg-lr-accent-dim text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add your first entry
                    <ChevronDown className="h-3 w-3 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56 bg-lr-surface border-lr-border shadow-[var(--shadow-lr-card)] p-1.5">
                  {[
                    { label: 'OKR', description: 'Objective with Key Results & Initiatives' },
                    { label: 'Deliverable', description: 'Concrete output or project commitment' },
                    { label: 'Goal', description: 'Personal or professional development goal' },
                  ].map(({ label, description }) => (
                    <DropdownMenuItem
                      key={label}
                      className="flex flex-col items-start gap-0.5 cursor-pointer py-2.5 px-3 rounded-[var(--radius-lr)] text-lr-text focus:bg-lr-accent-dim focus:text-lr-accent"
                      onClick={() => router.push(`/okrs/new?type=${encodeURIComponent(label)}`)}
                    >
                      <span className="font-semibold text-sm text-lr-text">+ {label}</span>
                      <span className="text-xs text-lr-muted">{description}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {(allOkrs ?? []).map((okr) => (
              <Link key={okr.id} href={`/okrs/${okr.id}`}>
                <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] px-4 py-3 hover:bg-lr-surface transition-colors cursor-pointer flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-lr-text truncate">{okr.title}</p>
                  <Badge variant="outline" className={`shrink-0 text-xs ${STATUS_BADGE[okr.status] ?? ''}`}>
                    {okr.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Section 1 — OKR Progress (live) */}
      <section className="space-y-4">
        <div>
          <h3 className="text-card-title">OKR / Deliverables / Goals Progress</h3>
          <p className="text-xs text-lr-muted mt-0.5">
            Tick off initiatives and update KR status — this is the live state of your OKRs, Deliverables and Goals.
            Add a narrative for what happened this quarter.
          </p>
        </div>

        {employeeOkrs.length === 0 ? (
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 text-center">
            <p className="text-sm text-lr-muted">No approved OKRs found for this period.</p>
          </div>
        ) : (
          okrNarratives.map((entry, index) => {
            const okr = employeeOkrs[index]
            const { total, done, pct } = computeOkrProgress(okr)
            return (
              <div
                key={entry.okr_id}
                className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] overflow-hidden"
              >
                {/* OKR header + progress bar */}
                <div className="px-5 py-4 border-b border-lr-border bg-lr-surface/40 space-y-3">
                  <h4 className="text-sm font-semibold text-lr-text">{okr.title}</h4>

                  {total > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-caption text-lr-muted">
                          {done} of {total} initiatives done · {pct}%
                        </p>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-lr-surface">
                        <div
                          className="h-full bg-lr-accent transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-caption text-lr-muted">No initiatives defined yet.</p>
                  )}
                </div>

                {/* Key results + initiatives */}
                {okr.key_results.length > 0 && (
                  <ul className="divide-y divide-lr-border">
                    {okr.key_results.map((kr, ki) => (
                      <li key={kr.id} className="px-5 py-3 space-y-2">
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-mono font-bold text-lr-accent mt-1 shrink-0">
                            KR{ki + 1}
                          </span>
                          <p className="text-sm text-lr-text flex-1">{kr.title}</p>
                          <div className="shrink-0">
                            {canEditLiveProgress ? (
                              <KrStatusSelect keyResultId={kr.id} status={kr.progress_status} />
                            ) : (
                              <KrStatusPill status={kr.progress_status} />
                            )}
                          </div>
                        </div>

                        {kr.initiatives.length > 0 && (
                          <ul className="pl-7 space-y-1.5">
                            {kr.initiatives.map((init) => (
                              <li key={init.id} className="flex items-start gap-2">
                                {canEditLiveProgress ? (
                                  <InitiativeCheckbox
                                    initiativeId={init.id}
                                    completed={init.completed}
                                  />
                                ) : (
                                  <span
                                    className={
                                      init.completed
                                        ? 'text-lr-success shrink-0 mt-0.5'
                                        : 'text-lr-muted shrink-0 mt-0.5'
                                    }
                                    aria-label={init.completed ? 'Done' : 'Not done'}
                                  >
                                    {init.completed ? (
                                      <CheckSquare className="h-4 w-4" />
                                    ) : (
                                      <Square className="h-4 w-4" />
                                    )}
                                  </span>
                                )}
                                <p
                                  className={`text-xs ${
                                    init.completed ? 'line-through text-lr-muted' : 'text-lr-text'
                                  }`}
                                >
                                  {init.title}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Narrative — what happened this quarter */}
                <div className="px-5 py-4 border-t border-lr-border space-y-1">
                  <Label className="text-caption">What happened this quarter?</Label>
                  <Textarea
                    value={entry.narrative}
                    onChange={(e) => updateOkrNarrative(index, e.target.value)}
                    disabled={disabled}
                    placeholder="The story behind the numbers: progress, blockers, what you learned…"
                    className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[100px] resize-y"
                  />
                </div>
              </div>
            )
          })
        )}
      </section>

      {/* Section 2 — Continue / Stop / Start */}
      <section className="space-y-4">
        <h3 className="text-card-title">Continue / Stop / Start</h3>
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 space-y-5">
          {[
            { label: 'What should you continue doing?', value: continueDoing, setter: setContinueDoing, name: 'continue_doing' },
            { label: 'What should you stop doing?', value: stopDoing, setter: setStopDoing, name: 'stop_doing' },
            { label: 'What should you start doing?', value: startDoing, setter: setStartDoing, name: 'start_doing' },
          ].map(({ label, value, setter, name }) => (
            <div key={name} className="space-y-1">
              <Label className="text-caption">{label}</Label>
              <Textarea
                value={value}
                onChange={(e) => setter(e.target.value)}
                disabled={disabled}
                placeholder={label}
                className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[80px] resize-y"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Section 3 — Living our values */}
      <section className="space-y-4">
        <div>
          <h3 className="text-card-title">Choose which values you lived this quarter</h3>
          <p className="text-xs text-lr-muted mt-0.5">
            Select the values you demonstrated and share concrete moments for each.
          </p>
        </div>

        {valueAssessments.length === 0 ? (
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-6 text-center">
            <p className="text-sm text-lr-muted">No company values configured yet.</p>
          </div>
        ) : (
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] overflow-hidden">
            {/* Checkbox list */}
            <div className="divide-y divide-lr-border">
              {valueAssessments.map((assessment) => {
                const meta = companyValues.find((cv) => cv.id === assessment.value_id)
                const isSelected = selectedValueIds.has(assessment.value_id)
                return (
                  <div key={assessment.value_id}>
                    {/* Value row — always visible */}
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && toggleValue(assessment.value_id)}
                      className={[
                        'w-full flex items-start gap-3 px-5 py-4 text-left transition-colors',
                        !disabled ? 'hover:bg-lr-surface/60 cursor-pointer' : 'cursor-default',
                        isSelected ? 'bg-lr-accent-dim' : '',
                      ].join(' ')}
                    >
                      <span className={[
                        'mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors',
                        isSelected
                          ? 'border-lr-accent bg-lr-accent'
                          : 'border-lr-border bg-lr-surface',
                      ].join(' ')}>
                        {isSelected && (
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 8">
                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-lr-text">{assessment.value_name}</p>
                        {meta?.description && (
                          <p className="text-xs text-lr-muted mt-0.5">{meta.description}</p>
                        )}
                      </div>
                    </button>

                    {/* Expanded detail — only when selected */}
                    {isSelected && (
                      <div className="px-5 pb-5 pt-2 space-y-4 border-t border-lr-border/50 bg-lr-surface/30">
                        <div className="space-y-2">
                          <Label className="text-caption">Self-rating</Label>
                          <div className="flex gap-1.5 flex-wrap">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                disabled={disabled}
                                onClick={() => updateValueRating(assessment.value_id, n)}
                                title={VALUE_SCORE_HINTS[n]}
                                className={[
                                  'h-9 min-w-[36px] px-2 rounded-md border text-sm font-bold transition-colors',
                                  assessment.rating === n
                                    ? 'border-lr-accent bg-lr-accent-dim text-lr-accent'
                                    : 'border-lr-border bg-lr-surface text-lr-muted hover:bg-lr-surface/80',
                                  disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                                ].join(' ')}
                              >
                                {n}
                              </button>
                            ))}
                            <span className="text-xs text-lr-muted self-center ml-2">
                              {VALUE_SCORE_HINTS[assessment.rating]}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-caption">Examples / moments where I demonstrated this</Label>
                          <Textarea
                            value={assessment.examples}
                            onChange={(e) => updateValueExamples(assessment.value_id, e.target.value)}
                            disabled={disabled}
                            placeholder={`Specific moments where you showed ${assessment.value_name.toLowerCase()}…`}
                            className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[80px] resize-y"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* Section 4 — Capability & Resource Needs */}
      <section className="space-y-4">
        <h3 className="text-card-title">Capability &amp; Resource Needs</h3>
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 space-y-1">
          <Label className="text-caption">What capabilities or resources do you need to achieve your goals?</Label>
          <Textarea
            value={capabilityNeeds}
            onChange={(e) => setCapabilityNeeds(e.target.value)}
            disabled={disabled}
            placeholder="Training, tools, budget, headcount, mentorship…"
            className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[100px] resize-y"
          />
        </div>
      </section>

      {/* Section 5 — Next quarter planning */}
      <section className="space-y-4">
        <div>
          <h3 className="text-card-title">OKR / Deliverables / Goals for next quarter</h3>
          <p className="text-xs text-lr-muted mt-0.5">
            Are you carrying over your current entries or starting fresh?
          </p>
        </div>
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 flex flex-wrap gap-3">
          <Link href="/okrs">
            <Button
              type="button"
              variant="outline"
              className="border-lr-border text-lr-text hover:bg-lr-surface gap-2"
            >
              Same as this quarter
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                className="bg-lr-accent hover:bg-lr-accent/90 text-white gap-2"
              >
                <Plus className="h-4 w-4" />
                New OKRs / Deliverables / Goals
                <ChevronDown className="h-3.5 w-3.5 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 bg-lr-surface border-lr-border shadow-[var(--shadow-lr-card)] p-1.5">
              {[
                { label: 'OKR', description: 'Objective with Key Results & Initiatives' },
                { label: 'Deliverable', description: 'Concrete output or project commitment' },
                { label: 'Goal', description: 'Personal or professional development goal' },
              ].map(({ label, description }) => (
                <DropdownMenuItem
                  key={label}
                  className="flex flex-col items-start gap-0.5 cursor-pointer py-2.5 px-3 rounded-[var(--radius-lr)] text-lr-text focus:bg-lr-accent-dim focus:text-lr-accent"
                  onClick={() => router.push(`/okrs/new?type=${encodeURIComponent(label)}`)}
                >
                  <span className="font-semibold text-sm text-lr-text">+ {label}</span>
                  <span className="text-xs text-lr-muted">{description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>

      {/* Hidden periodId field */}
      <input type="hidden" name="periodId" value={periodId} />

      {error && (
        <div className="rounded-[var(--radius-lr)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            disabled={isPending}
            variant="outline"
            onClick={onSave}
            className="border-lr-border text-lr-text hover:bg-lr-surface"
          >
            {isPending ? 'Saving…' : 'Save Draft'}
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={onSubmit}
            className="bg-lr-accent hover:bg-lr-accent/90 text-white"
          >
            {isPending ? 'Submitting…' : 'Submit Check-in'}
          </Button>
          {savedAt && (
            <span className="text-xs text-lr-muted">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
