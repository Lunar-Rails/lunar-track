'use client'

import { useTransition, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { togglePeriodStatus } from '@/lib/actions/period-actions'
import { format } from 'date-fns'
import type { PerformancePeriod } from '@/lib/types/database'

interface PeriodsManagerProps {
  periods: PerformancePeriod[]
}

function PeriodRow({ period }: { period: PerformancePeriod }) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleToggle = () => {
    setFeedback(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('periodId', period.id)
      formData.set('currentStatus', period.status)
      const result = await togglePeriodStatus(formData)
      if ('error' in result) {
        setFeedback(result.error)
      }
    })
  }

  return (
    <div className="flex items-center gap-4 py-3 border-b border-lr-border last:border-0">
      <div className="flex-1">
        <span className="text-item-label">{period.name}</span>
        <span className="text-caption ml-2">
          {format(new Date(period.start_date), 'MMM d')} – {format(new Date(period.end_date), 'MMM d, yyyy')}
        </span>
      </div>

      <Badge
        variant="outline"
        className={period.status === 'open'
          ? 'bg-lr-success-dim text-lr-success border-lr-success/20'
          : 'bg-lr-surface text-lr-muted border-lr-border'}
      >
        {period.status}
      </Badge>

      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={isPending}
        className="border-lr-border text-lr-text hover:bg-lr-surface text-xs"
      >
        {isPending ? '…' : period.status === 'open' ? 'Close' : 'Reopen'}
      </Button>

      {feedback && <p className="text-xs text-lr-error">{feedback}</p>}
    </div>
  )
}

export default function PeriodsManager({ periods }: PeriodsManagerProps) {
  if (periods.length === 0) {
    return (
      <p className="text-body text-lr-muted py-4">
        No performance periods found. They will be auto-created on next admin page visit.
      </p>
    )
  }

  // Group by year
  const byYear = periods.reduce<Record<number, PerformancePeriod[]>>((acc, p) => {
    ;(acc[p.year] ??= []).push(p)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(byYear)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([year, yearPeriods]) => (
          <div key={year}>
            <h3 className="text-card-title mb-3">{year}</h3>
            <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] px-4">
              {yearPeriods.map((p) => (
                <PeriodRow key={p.id} period={p} />
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}
