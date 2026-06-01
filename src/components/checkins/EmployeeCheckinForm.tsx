'use client'

import { useTransition, useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowRight } from 'lucide-react'
import MitReviewList from '@/components/checkins/MitReviewList'
import MitPlanList, { type LinkOption } from '@/components/checkins/MitPlanList'
import MoodSelector from '@/components/checkins/MoodSelector'
import { upsertCheckinEmployee } from '@/lib/actions/checkin-actions'
import type { Checkin, ReviewMit, PlanMit, MoodEnergy, MoodProductivity } from '@/lib/types/database'

interface EmployeeCheckinFormProps {
  periodId: string
  month: number
  year: number
  checkin: Checkin | null
  okrOptions: LinkOption[]
  readOnly?: boolean
}

function initReviewMits(checkin: Checkin | null): ReviewMit[] {
  if (!checkin) return [{ title: '', description: '', okr_id: null, okr_label: null, status: 'not_achieved' }]
  if (checkin.mits && checkin.mits.length > 0) {
    return checkin.mits.map((m) => ({
      title: m.title,
      description: m.description,
      okr_id: (m as ReviewMit).okr_id ?? null,
      okr_label: (m as ReviewMit).okr_label ?? null,
      status: (m as ReviewMit).status ?? 'not_achieved',
    }))
  }
  const legacy: ReviewMit[] = []
  if (checkin.mit_1_title) legacy.push({ title: checkin.mit_1_title, description: checkin.mit_1_description ?? '', okr_id: null, okr_label: null, status: 'not_achieved' })
  if (checkin.mit_2_title) legacy.push({ title: checkin.mit_2_title, description: checkin.mit_2_description ?? '', okr_id: null, okr_label: null, status: 'not_achieved' })
  if (checkin.mit_3_title) legacy.push({ title: checkin.mit_3_title, description: checkin.mit_3_description ?? '', okr_id: null, okr_label: null, status: 'not_achieved' })
  return legacy.length > 0 ? legacy : [{ title: '', description: '', okr_id: null, okr_label: null, status: 'not_achieved' }]
}

function initPlanMits(checkin: Checkin | null): PlanMit[] {
  if (!checkin?.next_mits || checkin.next_mits.length === 0) {
    return [{ title: '', description: '', okr_id: null, okr_label: null }]
  }
  return checkin.next_mits
}

type Step = 'review' | 'plan'

export default function EmployeeCheckinForm({
  periodId, month, year, checkin, okrOptions, readOnly = false,
}: EmployeeCheckinFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [step, setStep] = useState<Step>(() => searchParams.get('step') === 'plan' ? 'plan' : 'review')
  const [reviewMits, setReviewMits] = useState<ReviewMit[]>(() => initReviewMits(checkin))
  const [nextMits, setNextMits] = useState<PlanMit[]>(() => initPlanMits(checkin))

  // Remove ?step param from URL once consumed (from old bookmarks/refreshes)
  useEffect(() => {
    if (searchParams.get('step')) {
      window.history.replaceState(null, '', pathname)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [doneWell, setDoneWell] = useState(checkin?.done_well ?? '')
  const [doDifferently, setDoDifferently] = useState(checkin?.do_differently ?? '')
  const [moodEnergy, setMoodEnergy] = useState<MoodEnergy | null>(checkin?.mood_energy ?? null)
  const [moodProductivity, setMoodProductivity] = useState<MoodProductivity | null>(checkin?.mood_productivity ?? null)

  function buildFormData(submit: boolean): FormData {
    const fd = new FormData()
    fd.append('periodId', periodId)
    fd.append('month', String(month))
    fd.append('year', String(year))
    fd.append('review_mits', JSON.stringify(reviewMits.filter((m) => m.title.trim())))
    fd.append('next_mits', JSON.stringify(nextMits.filter((m) => m.title.trim())))
    fd.append('done_well', doneWell)
    fd.append('do_differently', doDifferently)
    if (moodEnergy) fd.append('mood_energy', moodEnergy)
    if (moodProductivity) fd.append('mood_productivity', moodProductivity)
    if (submit) fd.append('submit', 'true')
    return fd
  }

  function saveAndAdvance() {
    setError(null)
    startTransition(async () => {
      const result = await upsertCheckinEmployee(buildFormData(false))
      if ('error' in result) {
        setError(result.error)
      } else {
        setSavedAt(new Date())
        // Update URL silently if we got a new ID, then switch tab client-side (no page reload)
        if (result.id && !pathname.includes(result.id)) {
          window.history.replaceState(null, '', `/checkins/${result.id}`)
        }
        setStep('plan')
      }
    })
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await upsertCheckinEmployee(buildFormData(false))
      if ('error' in result) {
        setError(result.error)
      } else {
        setSavedAt(new Date())
        // Update URL silently if we got a new ID
        if (result.id && !pathname.includes(result.id)) {
          window.history.replaceState(null, '', `/checkins/${result.id}`)
        }
      }
    })
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await upsertCheckinEmployee(buildFormData(true))
      if ('error' in result) {
        setError(result.error)
      } else {
        // Show success immediately — don't make the user wait for the page refresh
        setSubmitted(true)
        router.refresh()
      }
    })
  }

  const tabs: { key: Step; label: string }[] = [
    { key: 'review', label: 'Review' },
    { key: 'plan', label: 'Next Month' },
  ]

  return (
    <div className="space-y-6">
      {(readOnly || submitted) && (
        <div className="max-w-3xl rounded-[var(--radius-lr)] border border-lr-accent/20 bg-lr-accent-dim px-4 py-3 text-sm text-lr-accent flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 8 6 12 14 4"/></svg>
          {submitted && !readOnly ? 'Check-in submitted successfully!' : 'You submitted this check-in. Editing is locked.'}
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
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-5 space-y-5">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-lr-text">What We Committed Last Month</p>
                <p className="text-xs text-lr-text/50 mt-0.5">Mark each commitment as achieved or not</p>
              </div>
              <MitReviewList value={reviewMits} onChange={setReviewMits} linkOptions={okrOptions} disabled={readOnly || isPending} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="done_well" className="text-sm font-semibold text-lr-text">Done well</Label>
                <Textarea id="done_well" value={doneWell} onChange={(e) => setDoneWell(e.target.value)} disabled={readOnly || isPending} placeholder="What went well this month?" className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[100px] resize-y" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="do_differently" className="text-sm font-semibold text-lr-text">Done differently</Label>
                <Textarea id="do_differently" value={doDifferently} onChange={(e) => setDoDifferently(e.target.value)} disabled={readOnly || isPending} placeholder="What would you change?" className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[100px] resize-y" />
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-5">
            <div className="mb-3">
              <p className="text-sm font-semibold text-lr-text">Monthly Pulse</p>
              <p className="text-xs text-lr-text/50 mt-0.5">Quick check on how you&apos;re feeling — visible to you and your manager</p>
            </div>
            <MoodSelector
              energy={moodEnergy}
              productivity={moodProductivity}
              onEnergyChange={setMoodEnergy}
              onProductivityChange={setMoodProductivity}
              disabled={readOnly || isPending}
            />
          </div>

          {error && (
            <div className="rounded-[var(--radius-lr)] border border-lr-error/20 bg-lr-error-dim px-4 py-3 text-sm text-lr-error">{error}</div>
          )}

          {!readOnly && (
            <div className="flex justify-end">
              <Button type="button" onClick={saveAndAdvance} disabled={isPending} className="bg-lr-accent hover:bg-lr-accent/90 text-white gap-2">
                {isPending ? 'Saving…' : <>Next Month <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Next Month tab */}
      {step === 'plan' && (
        <div className="space-y-5">
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-lr-text">Commitments for Next Month</p>
              <p className="text-xs text-lr-text/50 mt-0.5">These carry over to the review section of next month&apos;s check-in.</p>
            </div>
            <MitPlanList value={nextMits} onChange={setNextMits} linkOptions={okrOptions} linkLabel="Quarterly Goal" noLinkLabel="Unrelated to quarterly goals" disabled={readOnly || isPending} />
          </div>

          {error && (
            <div className="rounded-[var(--radius-lr)] border border-lr-error/20 bg-lr-error-dim px-4 py-3 text-sm text-lr-error">{error}</div>
          )}

          {!readOnly && (
            <div className="flex items-center gap-3">
              <Button type="button" onClick={save} disabled={isPending} variant="outline" className="border-lr-border text-lr-text hover:bg-lr-surface">
                {isPending ? 'Saving…' : 'Save Draft'}
              </Button>
              <Button type="button" onClick={submit} disabled={isPending} className="bg-lr-accent hover:bg-lr-accent/90 text-white">
                {isPending ? 'Submitting…' : 'Submit Check-in'}
              </Button>
              {savedAt && <span className="text-xs text-lr-muted">Saved {savedAt.toLocaleTimeString()}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
