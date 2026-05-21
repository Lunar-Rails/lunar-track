'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { upsertQuarterlyCheckinManager } from '@/lib/actions/quarterly-checkin-actions'
import type { QuarterlyCheckin, PerformancePeriod } from '@/lib/types/database'

interface Props {
  checkin: QuarterlyCheckin & { period?: PerformancePeriod }
  readOnly: boolean
}

export default function QuarterlyCheckinManagerForm({ checkin, readOnly }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const [okrFeedback, setOkrFeedback] = useState(checkin.mgr_okr_feedback ?? '')
  const [cssFeedback, setCssFeedback] = useState(checkin.mgr_css_feedback ?? '')
  const [supportPlan, setSupportPlan] = useState(checkin.mgr_support_plan ?? '')

  function buildFormData(submit: boolean): FormData {
    const fd = new FormData()
    fd.append('checkinId', checkin.id)
    if (okrFeedback) fd.append('mgr_okr_feedback', okrFeedback)
    if (cssFeedback) fd.append('mgr_css_feedback', cssFeedback)
    if (supportPlan) fd.append('mgr_support_plan', supportPlan)
    if (submit) fd.append('submit', 'true')
    return fd
  }

  function onSave() {
    setError(null)
    startTransition(async () => {
      const result = await upsertQuarterlyCheckinManager(buildFormData(false))
      if ('error' in result) setError(result.error)
      else setSavedAt(new Date())
    })
  }

  function onSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await upsertQuarterlyCheckinManager(buildFormData(true))
      if ('error' in result) setError(result.error)
      else router.refresh()
    })
  }

  const isSubmitted = !!checkin.manager_submitted_at
  const disabled = readOnly || isPending

  return (
    <div className="space-y-8">
      {isSubmitted && (
        <div className="rounded-[var(--radius-lr)] border border-lr-accent/20 bg-lr-accent-dim px-4 py-3 text-sm text-lr-accent">
          Manager review submitted.
        </div>
      )}

      {/* Section 1 — OKR / Deliverables / Goals Feedback */}
      <section className="space-y-4">
        <h3 className="text-card-title">OKR / Deliverables / Goals Feedback</h3>

        {/* Employee context (read-only narratives) */}
        {checkin.okr_progress.length > 0 && (
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-5 space-y-4">
            <p className="text-caption text-lr-muted">
              Employee&rsquo;s narrative per OKR / Deliverable / Goal. See the &ldquo;My Answers&rdquo; tab for live progress.
            </p>
            {checkin.okr_progress.map((entry) => (
              <div key={entry.okr_id} className="space-y-1">
                <p className="text-sm font-medium text-lr-text">{entry.okr_title}</p>
                {entry.narrative ? (
                  <p className="text-xs text-lr-muted whitespace-pre-wrap">{entry.narrative}</p>
                ) : (
                  <p className="text-xs text-lr-muted italic">No narrative provided.</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 space-y-1">
          <Label className="text-caption">Your feedback on OKR / Deliverables / Goals progress</Label>
          <Textarea
            value={okrFeedback}
            onChange={(e) => setOkrFeedback(e.target.value)}
            disabled={disabled}
            placeholder="Manager observations on OKR / Deliverables / Goals progress, blockers, calibration..."
            className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[100px] resize-y"
          />
        </div>
      </section>

      {/* Section 2 — Continue/Stop/Start Feedback */}
      <section className="space-y-4">
        <h3 className="text-card-title">Continue / Stop / Start Feedback</h3>

        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-5 space-y-3">
          <p className="text-caption text-lr-muted">Employee&rsquo;s answers</p>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-lr-text">Continue</p>
            <p className="text-xs text-lr-muted whitespace-pre-wrap">{checkin.continue_doing || '—'}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-lr-text">Stop</p>
            <p className="text-xs text-lr-muted whitespace-pre-wrap">{checkin.stop_doing || '—'}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-lr-text">Start</p>
            <p className="text-xs text-lr-muted whitespace-pre-wrap">{checkin.start_doing || '—'}</p>
          </div>
        </div>

        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 space-y-1">
          <Label className="text-caption">Your response</Label>
          <Textarea
            value={cssFeedback}
            onChange={(e) => setCssFeedback(e.target.value)}
            disabled={disabled}
            placeholder="What do you agree with? What would you add or push back on?"
            className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[100px] resize-y"
          />
        </div>
      </section>

      {/* Section 3 — Employee value self-assessments (read-only) */}
      {checkin.value_self_assessments && checkin.value_self_assessments.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-card-title">Living our values — Employee self-assessment</h3>
          <p className="text-xs text-lr-muted">
            Read-only view. You will rate each value when completing the quarterly score.
          </p>

          <div className="space-y-3">
            {checkin.value_self_assessments.map((sa) => (
              <div
                key={sa.value_id}
                className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-lr-text">{sa.value_name}</p>
                  <Badge
                    variant="outline"
                    className="text-xs border-lr-accent/30 bg-lr-accent-dim text-lr-accent shrink-0"
                  >
                    Self {sa.rating}/5
                  </Badge>
                </div>
                {sa.examples ? (
                  <p className="text-xs text-lr-muted whitespace-pre-wrap">{sa.examples}</p>
                ) : (
                  <p className="text-xs text-lr-muted italic">No examples provided.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 4 — Support Plan */}
      <section className="space-y-4">
        <h3 className="text-card-title">Support Plan</h3>

        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-5">
          <p className="text-caption text-lr-muted mb-2">Employee&rsquo;s capability &amp; resource needs</p>
          <p className="text-xs text-lr-muted whitespace-pre-wrap">{checkin.capability_needs || '—'}</p>
        </div>

        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 space-y-1">
          <Label className="text-caption">What support will you commit to providing?</Label>
          <Textarea
            value={supportPlan}
            onChange={(e) => setSupportPlan(e.target.value)}
            disabled={disabled}
            placeholder="Concrete commitments — training, headcount, intros, time, mentorship..."
            className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[100px] resize-y"
          />
        </div>
      </section>

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
            {isPending ? 'Submitting…' : 'Submit Feedback'}
          </Button>
          {savedAt && (
            <span className="text-xs text-lr-muted">Saved {savedAt.toLocaleTimeString()}</span>
          )}
        </div>
      )}
    </div>
  )
}
