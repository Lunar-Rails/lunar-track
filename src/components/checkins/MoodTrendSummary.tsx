import type { MoodEnergy, MoodProductivity } from '@/lib/types/database'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export interface MonthlyMood {
  month: number
  year: number
  mood_energy: MoodEnergy | null
  mood_productivity: MoodProductivity | null
}

interface MoodTrendSummaryProps {
  moods: MonthlyMood[]
}

const ENERGY_META: Record<MoodEnergy, { emoji: string; label: string; level: number; color: string }> = {
  terrible: { emoji: '😩', label: 'Terrible', level: 1, color: 'bg-red-400' },
  meh: { emoji: '😐', label: 'Meh', level: 2, color: 'bg-yellow-400' },
  okay: { emoji: '🙂', label: 'Okay', level: 3, color: 'bg-blue-400' },
  great: { emoji: '🔥', label: 'Great', level: 4, color: 'bg-green-400' },
}

const PRODUCTIVITY_META: Record<MoodProductivity, { emoji: string; label: string; level: number; color: string }> = {
  waste: { emoji: '🐌', label: 'Waste of time', level: 1, color: 'bg-red-400' },
  fine: { emoji: '👍', label: "Can't complain", level: 2, color: 'bg-blue-400' },
  ludicrous: { emoji: '🚀', label: 'LudicrousSpeed', level: 3, color: 'bg-green-400' },
}

function EnergyBar({ value, maxLevel = 4 }: { value: MoodEnergy | null; maxLevel?: number }) {
  if (!value) return <span className="text-xs text-lr-muted italic">Not recorded</span>
  const meta = ENERGY_META[value]
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: maxLevel }).map((_, i) => (
          <div
            key={i}
            className={`h-2 w-5 rounded-sm ${i < meta.level ? meta.color : 'bg-lr-border/50'}`}
          />
        ))}
      </div>
      <span className="text-xs text-lr-text">{meta.emoji} {meta.label}</span>
    </div>
  )
}

function ProductivityBar({ value, maxLevel = 3 }: { value: MoodProductivity | null; maxLevel?: number }) {
  if (!value) return <span className="text-xs text-lr-muted italic">Not recorded</span>
  const meta = PRODUCTIVITY_META[value]
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: maxLevel }).map((_, i) => (
          <div
            key={i}
            className={`h-2 w-5 rounded-sm ${i < meta.level ? meta.color : 'bg-lr-border/50'}`}
          />
        ))}
      </div>
      <span className="text-xs text-lr-text">{meta.emoji} {meta.label}</span>
    </div>
  )
}

export default function MoodTrendSummary({ moods }: MoodTrendSummaryProps) {
  const hasAnyMood = moods.some((m) => m.mood_energy || m.mood_productivity)

  if (!hasAnyMood) {
    return <p className="text-sm text-lr-muted italic">No mood data recorded this quarter.</p>
  }

  return (
    <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 space-y-3">
      <div className="grid grid-cols-1 gap-3">
        {moods.map((m, i) => (
          <div key={i} className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-lr-muted">
              {MONTH_NAMES[m.month - 1]} {m.year}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2 border-l-2 border-lr-accent/30">
              <div className="space-y-0.5">
                <p className="text-[10px] text-lr-muted">Energy</p>
                <EnergyBar value={m.mood_energy} />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-lr-muted">Productivity</p>
                <ProductivityBar value={m.mood_productivity} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
