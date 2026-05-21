'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import type { QuarterlyGoalReview } from '@/lib/types/database'

interface GoalAchievementListProps {
  value: QuarterlyGoalReview[]
  onChange: (goals: QuarterlyGoalReview[]) => void
  disabled?: boolean
}

export default function GoalAchievementList({ value, onChange, disabled = false }: GoalAchievementListProps) {
  function toggleStatus(index: number) {
    if (disabled) return
    const current = value[index].status
    const next = current === 'achieved' ? 'not_achieved' : 'achieved'
    onChange(value.map((g, i) => i === index ? { ...g, status: next } : g))
  }

  if (value.length === 0) {
    return <p className="text-sm text-lr-muted italic">No goals were set for this quarter.</p>
  }

  return (
    <div className="space-y-3">
      {value.map((goal, index) => (
        <div key={goal.id} className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-lr-text">{goal.title}</p>
            {goal.description && <p className="text-xs text-lr-muted mt-1">{goal.description}</p>}
          </div>
          <button
            type="button"
            onClick={() => toggleStatus(index)}
            disabled={disabled}
            className="flex items-center gap-1.5 text-xs font-medium flex-shrink-0 transition-colors disabled:opacity-50"
          >
            {goal.status === 'achieved' ? (
              <><CheckCircle2 className="h-4 w-4 text-green-400" /><span className="text-green-400">Achieved</span></>
            ) : (
              <><XCircle className="h-4 w-4 text-red-400" /><span className="text-red-400">Not achieved</span></>
            )}
          </button>
        </div>
      ))}
    </div>
  )
}
