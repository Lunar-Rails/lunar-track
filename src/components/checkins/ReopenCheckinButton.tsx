'use client'

import { useState, useTransition } from 'react'
import { RotateCcw } from 'lucide-react'
import { reopenCheckin } from '@/lib/actions/checkin-actions'

interface ReopenCheckinButtonProps {
  checkinId: string
}

export default function ReopenCheckinButton({ checkinId }: ReopenCheckinButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await reopenCheckin(checkinId)
      if ('error' in result) {
        setError(result.error)
        setShowConfirm(false)
      }
      // On success the page revalidates and re-renders as editable
    })
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-lr-muted">Reopen and edit?</span>
        <button
          onClick={handleConfirm}
          disabled={isPending}
          className="h-8 px-3 rounded-[var(--radius-lr)] bg-lr-accent text-white text-xs font-medium hover:bg-lr-accent/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Reopening…' : 'Yes, reopen'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isPending}
          className="h-8 px-3 rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface text-xs text-lr-muted hover:text-lr-text transition-colors"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-lr-error">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface text-xs text-lr-muted hover:text-lr-text hover:border-lr-accent/40 transition-colors"
      >
        <RotateCcw className="h-3 w-3" />
        Reopen &amp; edit
      </button>
      {error && <span className="text-xs text-lr-error">{error}</span>}
    </div>
  )
}
