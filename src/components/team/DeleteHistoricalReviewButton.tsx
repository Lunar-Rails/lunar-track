'use client'

import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteHistoricalReview } from '@/lib/actions/historical-review-actions'

export default function DeleteHistoricalReviewButton({ id, employeeId }: { id: string; employeeId: string }) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('Delete this historical review?')) return
    setDeleting(true)
    await deleteHistoricalReview(id, employeeId)
    setDeleting(false)
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="text-lr-muted/40 hover:text-lr-error transition-colors disabled:opacity-50"
      title="Delete"
    >
      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  )
}
