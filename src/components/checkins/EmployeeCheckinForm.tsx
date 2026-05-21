'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import MitReviewList from '@/components/checkins/MitReviewList'
import MitPlanList, { type LinkOption } from '@/components/checkins/MitPlanList'
import { upsertCheckinEmployee } from '@/lib/actions/checkin-actions'
import type { Checkin, ReviewMit, PlanMit } from '@/lib/types/database'

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

export default function EmployeeCheckinForm({
  periodId, month, year, checkin, okrOptions, readOnly = false,
}: EmployeeCheckinFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [reviewMits, setReviewMits] = useState<ReviewMit[]>(() => initReviewMits(checkin))
  const [nextMits, setNextMits] = useState<PlanMit[]>(() => initPlanMits(checkin))
  const [doneWell, setDoneWell] = useState(checkin?.done_well ?? '')
  const [doDifferently, setDoDifferently] = useState(checkin?.do_differently ?? '')

  function buildFormData(submit: boolean): FormData {
    const fd = new FormData()
    fd.append('periodId', periodId)
    fd.append('month', String(month))
    fd.append('year', String(year))
    fd.append('review_mits', JSON.stringify(reviewMits.filter((m) => m.title.trim())))
    fd.append('next_mits', JSON.stringify(nextMits.filter((m) => m.title.trim())))
    fd.append('done_well', doneWell)
    fd.append('do_differently', doDifferently)
    if (submit) fd.append('submit', 'true')
    return fd
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await upsertCheckinEmployee(buildFormData(false))
      if ('error' in result) {
        setError(result.error)
      } else {
        setSavedAt(new Date())
        if (result.id) router.replace(`/checkins/${result.id}`)
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
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      {readOnly && (
        <div className="rounded-[var(--radius-lr)] border border-lr-accent/20 bg-lr-accent-dim px-4 py-3 text-sm text-lr-accent">
          You submitted this check-in. Editing is locked.
        </div>
      )}

      <section className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-5 space-y-5">
        <h3 className="text-card-title text-lr-accent">Review</h3>
        <div className="space-y-2">
          <p className="text-section-label">What We Committed Last Month</p>
          <MitReviewList value={reviewMits} onChange={setReviewMits} disabled={readOnly || isPending} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="done_well" className="text-caption">Done well</Label>
            <Textarea id="done_well" value={doneWell} onChange={(e) => setDoneWell(e.target.value)} disabled={readOnly || isPending} placeholder="What went well this month?" className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[100px] resize-y" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="do_differently" className="text-caption">Done differently</Label>
            <Textarea id="do_differently" value={doDifferently} onChange={(e) => setDoDifferently(e.target.value)} disabled={readOnly || isPending} placeholder="What would you change?" className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[100px] resize-y" />
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-5 space-y-4">
        <div>
          <h3 className="text-card-title text-lr-accent">Next Month</h3>
          <p className="text-xs text-lr-muted mt-1">These MITs will carry over to the review section of next month&apos;s check-in.</p>
        </div>
        <MitPlanList value={nextMits} onChange={setNextMits} linkOptions={okrOptions} linkLabel="Quarterly Goal" noLinkLabel="Unrelated to quarterly goals" disabled={readOnly || isPending} />
      </section>

      {error && (
        <div className="rounded-[var(--radius-lr)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
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
  )
}
