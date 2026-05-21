'use client'

import { useTransition, useState } from 'react'
import { approveTeamRequest, declineTeamRequest } from '@/lib/actions/onboarding-actions'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'

interface PendingEmployee {
  id: string
  email: string
  full_name: string | null
  created_at: string
}

export default function PendingApprovals({ requests }: { requests: PendingEmployee[] }) {
  const [isPending, startTransition] = useTransition()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})

  const visible = requests.filter(r => !dismissed.has(r.id))

  if (visible.length === 0) return null

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveTeamRequest(id)
      if ('error' in result) {
        setErrors(prev => ({ ...prev, [id]: result.error }))
      } else {
        setDismissed(prev => new Set([...prev, id]))
      }
    })
  }

  function handleDecline(id: string) {
    startTransition(async () => {
      const result = await declineTeamRequest(id)
      if ('error' in result) {
        setErrors(prev => ({ ...prev, [id]: result.error }))
      } else {
        setDismissed(prev => new Set([...prev, id]))
      }
    })
  }

  return (
    <div className="rounded-[var(--radius-lr-lg)] border border-lr-gold/20 bg-lr-gold-dim backdrop-blur-[8px] p-6 shadow-[var(--shadow-lr-card)]">
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-lr-gold text-xs font-bold text-black">
          {visible.length}
        </span>
        <h2 className="text-card-title">Pending team requests</h2>
      </div>
      <p className="text-caption text-lr-muted mb-4">
        These employees have selected you as their manager and are waiting for your approval.
      </p>
      <ul className="space-y-3">
        {visible.map(req => (
          <li
            key={req.id}
            className="flex items-center justify-between gap-4 rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-body font-medium truncate">{req.full_name ?? req.email}</p>
              {req.full_name && (
                <p className="text-caption text-lr-muted truncate">{req.email}</p>
              )}
              {errors[req.id] && (
                <p className="text-xs text-red-400 mt-1">{errors[req.id]}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => handleApprove(req.id)}
                className="h-8 gap-1.5 bg-lr-success/10 border border-lr-success/30 text-lr-success hover:bg-lr-success/20 text-xs"
                variant="outline"
              >
                <Check className="h-3.5 w-3.5" />
                Approve
              </Button>
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => handleDecline(req.id)}
                className="h-8 gap-1.5 bg-lr-error/10 border border-lr-error/30 text-lr-error hover:bg-lr-error/20 text-xs"
                variant="outline"
              >
                <X className="h-3.5 w-3.5" />
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
