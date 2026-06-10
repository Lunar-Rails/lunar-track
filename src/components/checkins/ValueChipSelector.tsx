'use client'

import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { CompanyValue, ValueAssessment } from '@/lib/types/database'

interface ValueChipSelectorProps {
  companyValues: CompanyValue[]
  value: ValueAssessment[]
  onChange: (assessments: ValueAssessment[]) => void
  disabled?: boolean
}

export default function ValueChipSelector({ companyValues, value, onChange, disabled = false }: ValueChipSelectorProps) {
  const selectedIds = new Set(value.map((a) => a.value_id))
  const descById = new Map(companyValues.map((cv) => [cv.id, cv.description]))

  function toggle(cv: CompanyValue) {
    if (disabled) return
    if (selectedIds.has(cv.id)) {
      onChange(value.filter((a) => a.value_id !== cv.id))
    } else {
      onChange([...value, { value_id: cv.id, value_name: cv.name, description: '' }])
    }
  }

  function updateDescription(value_id: string, description: string) {
    onChange(value.map((a) => a.value_id === value_id ? { ...a, description } : a))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {companyValues.map((cv) => {
          const selected = selectedIds.has(cv.id)
          return (
            <button
              key={cv.id}
              type="button"
              onClick={() => toggle(cv)}
              disabled={disabled}
              title={cv.description}
              className={[
                'rounded-full px-4 py-1.5 text-sm font-medium border transition-colors',
                selected ? 'bg-lr-accent/20 border-lr-accent text-lr-accent' : 'bg-lr-surface border-lr-border text-lr-muted hover:border-lr-accent/50',
                disabled ? 'opacity-50 cursor-default' : 'cursor-pointer',
              ].join(' ')}
            >
              {selected && <span className="mr-1">✓</span>}
              {cv.name}
            </button>
          )
        })}
      </div>
      {value.length > 0 && (
        <div className="space-y-3">
          {value.map((assessment) => (
            <div key={assessment.value_id} className="rounded-[var(--radius-lr-lg)] border-l-2 border-lr-accent bg-lr-surface p-4 space-y-2">
              <Label className="text-caption text-lr-accent">{assessment.value_name}</Label>
              {descById.get(assessment.value_id) && (
                <p className="text-xs text-lr-muted leading-snug">{descById.get(assessment.value_id)}</p>
              )}
              <Textarea
                value={assessment.description}
                onChange={(e) => updateDescription(assessment.value_id, e.target.value)}
                disabled={disabled}
                placeholder={`How did you demonstrate ${assessment.value_name} this quarter?`}
                className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[80px] resize-y"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
