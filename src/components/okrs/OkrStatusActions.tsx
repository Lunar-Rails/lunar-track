'use client'

import { useTransition, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { transitionOkrStatus } from '@/lib/actions/okr-actions'
import type { Okr, Profile } from '@/lib/types/database'

interface OkrStatusActionsProps {
  okr: Okr
  caller: Profile
}

export default function OkrStatusActions({ okr, caller }: OkrStatusActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isOwner = okr.employee_id === caller.id

  const doTransition = (toStatus: string, withComment = false) => {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('okrId', okr.id)
      fd.set('toStatus', toStatus)
      if (withComment && comment) fd.set('comment', comment)
      const result = await transitionOkrStatus(fd)
      if ('error' in result) setError(result.error)
    })
  }

  return (
    <div className="space-y-3">
      {/* Owner: submit for review */}
      {isOwner && okr.status === 'DRAFT' && (
        <Button
          onClick={() => doTransition('PENDING_REVIEW')}
          disabled={isPending}
          className="bg-lr-accent hover:bg-lr-accent-hover text-white"
        >
          Submit for Review
        </Button>
      )}
      {/* Owner: resubmit after revision */}
      {isOwner && okr.status === 'REVISION_REQUESTED' && (
        <Button
          onClick={() => doTransition('PENDING_REVIEW')}
          disabled={isPending}
          className="bg-lr-accent hover:bg-lr-accent-hover text-white"
        >
          Resubmit for Review
        </Button>
      )}

      {/* Manager: approve or request revision */}
      {!isOwner && okr.status === 'PENDING_REVIEW' && (
        <div className="space-y-3 rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-5">
          <p className="text-card-title">Review this Goal</p>
          <div className="space-y-1.5">
            <label className="text-section-label">Comment (optional for approval, recommended for revision)</label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Leave feedback for the employee…"
              rows={3}
              className="bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted resize-none"
            />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => doTransition('APPROVED', true)}
              disabled={isPending}
              className="bg-lr-success hover:bg-lr-success/80 text-white"
            >
              Approve
            </Button>
            <Button
              onClick={() => doTransition('REVISION_REQUESTED', true)}
              disabled={isPending || !comment}
              variant="outline"
              className="border-lr-error text-lr-error hover:bg-lr-error-dim"
            >
              Request Revision
            </Button>
          </div>
          {!comment && (
            <p className="text-caption text-lr-muted">A comment is required to request revision.</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-lr-error">{error}</p>}
    </div>
  )
}
