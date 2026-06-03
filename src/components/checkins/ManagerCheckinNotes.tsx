'use client'

import { useState, useTransition, useRef } from 'react'
import { Lock, CheckCircle2 } from 'lucide-react'
import { upsertCheckinManager } from '@/lib/actions/checkin-actions'
import type { Checkin } from '@/lib/types/database'

interface ManagerCheckinNotesProps {
  checkin: Checkin
  /** true when the logged-in user is the manager editing their own notes */
  isEditable: boolean
}

function NoteField({
  label, name, defaultValue, placeholder, disabled,
}: {
  label: string
  name: string
  defaultValue: string
  placeholder: string
  disabled: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-lr-muted">{label}</label>
      <textarea
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        rows={3}
        placeholder={disabled ? '' : placeholder}
        className="w-full rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface/60 px-3 py-2.5 text-sm text-lr-text placeholder:text-lr-muted/40 focus:outline-none focus:border-lr-accent/60 resize-none leading-relaxed transition-colors disabled:opacity-60 disabled:cursor-default"
      />
    </div>
  )
}

export default function ManagerCheckinNotes({ checkin, isEditable }: ManagerCheckinNotesProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitted, setSubmitted] = useState(!!checkin.manager_submitted_at)
  const [editingAfterSubmit, setEditingAfterSubmit] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const isLocked = submitted && !editingAfterSubmit
  const formDisabled = !isEditable || isLocked || isPending

  function runAction(submitFlag: boolean) {
    if (!formRef.current) return
    setError(null)
    setSaved(false)

    const fd = new FormData(formRef.current)
    fd.set('checkinId', checkin.id)
    if (submitFlag) fd.set('submit', 'true')

    startTransition(async () => {
      const result = await upsertCheckinManager(fd)
      if ('error' in result) {
        setError(result.error)
      } else if (submitFlag) {
        setSubmitted(true)
        setEditingAfterSubmit(false)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    })
  }

  return (
    <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-lr-border">
        <div>
          <h2 className="text-sm font-semibold text-lr-text">Manager Notes</h2>
          <p className="text-xs text-lr-muted mt-0.5">
            {isEditable
              ? isLocked
                ? 'Submitted — employee has been notified'
                : 'Visible to the employee once you submit'
              : checkin.manager_submitted_at
                ? 'Your manager has reviewed this check-in'
                : 'Manager notes not yet added'}
          </p>
        </div>
        {isEditable && submitted && !editingAfterSubmit && (
          <button
            type="button"
            onClick={() => setEditingAfterSubmit(true)}
            className="text-xs text-lr-accent hover:underline"
          >
            Edit notes
          </button>
        )}
      </div>

      {/* Empty state for employee before manager submits */}
      {!isEditable && !checkin.manager_submitted_at && (
        <div className="px-6 py-10 text-center text-sm text-lr-muted/60 italic">
          No manager notes yet.
        </div>
      )}

      {/* Notes form / read-only view */}
      {(isEditable || checkin.manager_submitted_at) && (
        <form
          ref={formRef}
          onSubmit={(e) => e.preventDefault()}
          className="px-6 py-5 space-y-4"
        >
          <NoteField
            label="Feedback on commitments"
            name="mgr_mit_notes"
            defaultValue={checkin.mgr_mit_notes ?? ''}
            placeholder="Share your observations on how they performed against their MITs…"
            disabled={formDisabled}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NoteField
              label="What went well"
              name="mgr_done_well"
              defaultValue={checkin.mgr_done_well ?? ''}
              placeholder="Strengths you observed this month…"
              disabled={formDisabled}
            />
            <NoteField
              label="What to improve"
              name="mgr_do_differently"
              defaultValue={checkin.mgr_do_differently ?? ''}
              placeholder="Areas for growth or things to change…"
              disabled={formDisabled}
            />
          </div>

          <NoteField
            label="How you'll support them"
            name="mgr_support_commitments"
            defaultValue={checkin.mgr_support_commitments ?? ''}
            placeholder="What you commit to doing to help them succeed…"
            disabled={formDisabled}
          />

          {/* Private note — manager only */}
          {isEditable && (
            <div className="space-y-1.5 pt-1 border-t border-lr-border/50">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-lr-muted shrink-0" />
                <label className="text-xs font-medium text-lr-muted">
                  Private note{' '}
                  <span className="font-normal text-lr-muted/60">(not visible to employee)</span>
                </label>
              </div>
              <textarea
                name="mgr_private_note"
                defaultValue={checkin.mgr_private_note ?? ''}
                disabled={formDisabled}
                rows={2}
                placeholder={formDisabled ? '' : 'For your eyes only…'}
                className="w-full rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface/60 px-3 py-2.5 text-sm text-lr-text placeholder:text-lr-muted/40 focus:outline-none focus:border-lr-accent/60 resize-none leading-relaxed transition-colors disabled:opacity-60 disabled:cursor-default"
              />
            </div>
          )}

          {error && <p className="text-xs text-lr-error">{error}</p>}

          {/* Action buttons — manager only, unlocked state */}
          {isEditable && !isLocked && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => runAction(false)}
                disabled={isPending}
                className="h-9 px-4 rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface text-sm text-lr-muted hover:text-lr-text transition-colors disabled:opacity-50"
              >
                {isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save draft'}
              </button>
              <button
                type="button"
                onClick={() => runAction(true)}
                disabled={isPending}
                className="h-9 px-4 rounded-[var(--radius-lr)] bg-lr-accent hover:bg-lr-accent/90 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isPending ? 'Submitting…' : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Submit &amp; notify employee
                  </>
                )}
              </button>
            </div>
          )}

          {/* Submitted confirmation */}
          {isEditable && isLocked && (
            <div className="flex items-center gap-2 text-xs text-lr-accent pt-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Notes submitted — employee notified
            </div>
          )}
        </form>
      )}
    </div>
  )
}
