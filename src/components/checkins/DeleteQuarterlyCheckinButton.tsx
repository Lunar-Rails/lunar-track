'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteQuarterlyCheckin } from '@/lib/actions/quarterly-checkin-actions'

export default function DeleteQuarterlyCheckinButton({ checkinId }: { checkinId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm('Delete this quarterly review? This cannot be undone.')) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('checkinId', checkinId)
      const result = await deleteQuarterlyCheckin(fd)
      if ('error' in result) {
        alert(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      aria-label="Delete quarterly review"
      className="p-1.5 rounded text-lr-muted hover:text-lr-error hover:bg-lr-error/10 transition-colors disabled:opacity-50 shrink-0"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
