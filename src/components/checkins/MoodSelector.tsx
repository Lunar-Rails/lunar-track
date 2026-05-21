'use client'

import type { MoodEnergy, MoodProductivity } from '@/lib/types/database'
import { ENERGY_OPTIONS, PRODUCTIVITY_OPTIONS } from '@/lib/constants/mood'

interface MoodSelectorProps {
  energy: MoodEnergy | null
  productivity: MoodProductivity | null
  onEnergyChange: (value: MoodEnergy) => void
  onProductivityChange: (value: MoodProductivity) => void
  disabled?: boolean
}

export default function MoodSelector({
  energy,
  productivity,
  onEnergyChange,
  onProductivityChange,
  disabled = false,
}: MoodSelectorProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <p className="text-sm font-medium text-lr-text">How was your energy this month?</p>
        <div className="flex flex-wrap gap-2">
          {ENERGY_OPTIONS.map((opt) => {
            const isSelected = energy === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => onEnergyChange(opt.value)}
                className={[
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150',
                  'border focus:outline-none focus-visible:ring-2 focus-visible:ring-lr-accent/50',
                  isSelected
                    ? 'border-lr-accent bg-lr-accent/15 text-lr-accent shadow-[0_0_12px_rgba(124,92,252,0.15)]'
                    : 'border-lr-border bg-lr-surface/50 text-lr-text/70 hover:bg-lr-surface hover:text-lr-text hover:border-lr-text/20',
                  disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                <span className="text-lg leading-none">{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-sm font-medium text-lr-text">How productive did you feel this month?</p>
        <div className="flex flex-wrap gap-2">
          {PRODUCTIVITY_OPTIONS.map((opt) => {
            const isSelected = productivity === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => onProductivityChange(opt.value)}
                className={[
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150',
                  'border focus:outline-none focus-visible:ring-2 focus-visible:ring-lr-accent/50',
                  isSelected
                    ? 'border-lr-accent bg-lr-accent/15 text-lr-accent shadow-[0_0_12px_rgba(124,92,252,0.15)]'
                    : 'border-lr-border bg-lr-surface/50 text-lr-text/70 hover:bg-lr-surface hover:text-lr-text hover:border-lr-text/20',
                  disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                <span className="text-lg leading-none">{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
