'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'
import { deleteOkr } from '@/lib/actions/okr-actions'

export default function DeleteGoalButton({ okrId, iconOnly = false }: { okrId: string; iconOnly?: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('okrId', okrId)
      const result = await deleteOkr(fd)
      if ('error' in result) {
        setError(result.error)
        setOpen(false)
      } else {
        router.push('/okrs')
      }
    })
  }

  const trigger = iconOnly ? (
    <button
      type="button"
      disabled={isPending}
      aria-label="Delete goal"
      className="p-1.5 rounded text-lr-muted hover:text-lr-error hover:bg-lr-error/10 transition-colors disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  ) : (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      className="border-lr-error/30 text-lr-error hover:bg-lr-error-dim hover:border-lr-error/50"
    >
      <Trash2 className="h-4 w-4 mr-1.5" />
      {isPending ? 'Deleting…' : 'Delete Goal'}
    </Button>
  )

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be moved to the deleted goals log and hidden from your dashboard. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-lr-error hover:bg-lr-error/90 text-white"
            >
              {isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <p className="text-xs text-lr-error">{error}</p>}
    </div>
  )
}
