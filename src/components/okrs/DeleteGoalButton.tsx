'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { deleteOkr } from '@/lib/actions/okr-actions'

export default function DeleteGoalButton({ okrId }: { okrId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm('Delete this goal? It will be moved to the deleted goals log and hidden from your dashboard.')) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('okrId', okrId)
      const result = await deleteOkr(fd)
      if ('error' in result) {
        alert(result.error)
      } else {
        router.push('/okrs')
      }
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleDelete}
      disabled={isPending}
      className="border-lr-error/30 text-lr-error hover:bg-lr-error-dim hover:border-lr-error/50"
    >
      <Trash2 className="h-4 w-4 mr-1.5" />
      {isPending ? 'Deleting…' : 'Delete Goal'}
    </Button>
  )
}
