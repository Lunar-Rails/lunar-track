'use client'

import { useTransition, useState } from 'react'
import { CheckSquare, Square, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  toggleInitiativeCompleted,
  updateKeyResultStatus,
} from '@/lib/actions/okr-progress-actions'
import type { KeyResultProgressStatus } from '@/lib/types/database'

const STATUS_LABELS: Record<KeyResultProgressStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  on_track: 'On track',
  at_risk: 'At risk',
  done: 'Done',
}

export const KR_STATUS_PILL: Record<KeyResultProgressStatus, string> = {
  not_started: 'bg-lr-surface text-lr-muted border-lr-border',
  in_progress: 'bg-lr-accent-dim text-lr-accent border-lr-accent/20',
  on_track: 'bg-lr-cyan-dim text-lr-cyan border-lr-cyan/20',
  at_risk: 'bg-lr-gold-dim text-lr-gold border-lr-gold/20',
  done: 'bg-lr-success-dim text-lr-success border-lr-success/20',
}

export function KrStatusPill({ status }: { status: KeyResultProgressStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${KR_STATUS_PILL[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

export function KrStatusSelect({
  keyResultId,
  status,
}: {
  keyResultId: string
  status: KeyResultProgressStatus
}) {
  const [isPending, startTransition] = useTransition()
  const [current, setCurrent] = useState<KeyResultProgressStatus>(status)
  const [error, setError] = useState<string | null>(null)

  function onChange(next: string) {
    const nextStatus = next as KeyResultProgressStatus
    const previous = current
    setCurrent(nextStatus)
    setError(null)
    startTransition(async () => {
      const result = await updateKeyResultStatus(keyResultId, nextStatus)
      if ('error' in result) {
        setCurrent(previous)
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={current} onValueChange={onChange} disabled={isPending}>
        <SelectTrigger size="sm" className="w-[150px] bg-lr-surface border-lr-border text-xs text-lr-text">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-lr-bg border-lr-border text-lr-text">
          {(Object.keys(STATUS_LABELS) as KeyResultProgressStatus[]).map((s) => (
            <SelectItem key={s} value={s} className="text-lr-text focus:bg-lr-surface">
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending && <Loader2 className="h-3 w-3 animate-spin text-lr-muted" />}
      {error && <span className="text-xs text-lr-error">{error}</span>}
    </div>
  )
}

export function InitiativeCheckbox({
  initiativeId,
  completed,
  disabled = false,
}: {
  initiativeId: string
  completed: boolean
  disabled?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [current, setCurrent] = useState(completed)
  const [error, setError] = useState<string | null>(null)

  function onToggle() {
    if (disabled || isPending) return
    const next = !current
    const previous = current
    setCurrent(next)
    setError(null)
    startTransition(async () => {
      const result = await toggleInitiativeCompleted(initiativeId, next)
      if ('error' in result) {
        setCurrent(previous)
        setError(result.error)
      }
    })
  }

  const Icon = current ? CheckSquare : Square

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || isPending}
      aria-pressed={current}
      aria-label={current ? 'Mark initiative as not done' : 'Mark initiative as done'}
      className={`shrink-0 mt-0.5 transition-colors ${
        disabled
          ? 'cursor-default opacity-60'
          : 'cursor-pointer hover:text-lr-accent'
      } ${current ? 'text-lr-success' : 'text-lr-muted'}`}
      title={error ?? undefined}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
    </button>
  )
}
