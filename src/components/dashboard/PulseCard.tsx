import Link from 'next/link'
import type { MoodEnergy, MoodProductivity } from '@/lib/types/database'
import { ENERGY_OPTIONS, PRODUCTIVITY_OPTIONS, ENERGY_META, PRODUCTIVITY_META } from '@/lib/constants/mood'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface MonthlyMoodEntry {
  month: number
  year: number
  mood_energy: MoodEnergy | null
  mood_productivity: MoodProductivity | null
}

interface PulseCardProps {
  currentEnergy: MoodEnergy | null
  currentProductivity: MoodProductivity | null
  hasCheckinThisMonth: boolean
  trend: MonthlyMoodEntry[]
}

function MoodPills<T extends string>({
  options,
  active,
}: {
  options: { value: T; emoji: string; label: string }[]
  active: T | null
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = active === opt.value
        return (
          <span
            key={opt.value}
            className={[
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-none',
              isActive
                ? 'border-lr-accent bg-lr-accent/15 text-lr-accent shadow-[0_0_10px_rgba(124,92,252,0.12)]'
                : 'border-lr-border/50 bg-lr-surface/30 text-lr-text/30',
            ].join(' ')}
          >
            <span className={isActive ? 'opacity-100' : 'opacity-30'}>{opt.emoji}</span>
            {opt.label}
          </span>
        )
      })}
    </div>
  )
}

function TrendBar({ level, maxLevel, color }: { level: number; maxLevel: number; color: string }) {
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: maxLevel }).map((_, i) => (
        <div key={i} className={`h-1.5 w-4 rounded-sm ${i < level ? color : 'bg-lr-border/40'}`} />
      ))}
    </div>
  )
}

export default function PulseCard({
  currentEnergy,
  currentProductivity,
  hasCheckinThisMonth,
  trend,
}: PulseCardProps) {
  const hasCurrentMood = currentEnergy || currentProductivity
  const hasTrend = trend.length > 0

  return (
    <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)] space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-card-title">My Pulse</h2>
        {hasCheckinThisMonth && (
          <Link href="/checkins" className="text-xs text-lr-muted hover:text-lr-accent transition-colors">
            View check-ins →
          </Link>
        )}
      </div>

      {/* Current month */}
      {hasCheckinThisMonth && hasCurrentMood ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-lr-muted">Energy</p>
            <MoodPills options={ENERGY_OPTIONS} active={currentEnergy} />
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-lr-muted">Productivity</p>
            <MoodPills options={PRODUCTIVITY_OPTIONS} active={currentProductivity} />
          </div>
        </div>
      ) : hasCheckinThisMonth && !hasCurrentMood ? (
        <p className="text-sm text-lr-muted italic">No pulse recorded for this check-in.</p>
      ) : (
        <div className="rounded-[var(--radius-lr)] border border-lr-border/50 bg-lr-surface/30 px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-lr-muted">Log your pulse in this month&apos;s check-in</p>
          <Link
            href="/checkins/new"
            className="shrink-0 rounded-[var(--radius-lr)] bg-lr-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-lr-accent/90 transition-colors"
          >
            Start →
          </Link>
        </div>
      )}

      {/* Trend */}
      {hasTrend && (
        <>
          <div className="border-t border-lr-border/40" />
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-lr-muted">Trend</p>
            <div className="space-y-2">
              {trend.map((entry) => {
                const energyMeta = entry.mood_energy ? ENERGY_META[entry.mood_energy] : null
                const productivityMeta = entry.mood_productivity ? PRODUCTIVITY_META[entry.mood_productivity] : null
                return (
                  <div key={`${entry.year}-${entry.month}`} className="flex items-center gap-3">
                    <span className="text-[10px] font-medium text-lr-muted w-7 shrink-0">
                      {MONTH_NAMES[entry.month - 1]}
                    </span>
                    <div className="flex items-center gap-4 flex-1">
                      {energyMeta ? (
                        <div className="flex items-center gap-1.5">
                          <TrendBar level={energyMeta.level} maxLevel={4} color={energyMeta.color} />
                          <span className="text-sm leading-none" title={`Energy: ${energyMeta.label}`}>{energyMeta.emoji}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-lr-muted/40">—</span>
                      )}
                      {productivityMeta ? (
                        <div className="flex items-center gap-1.5">
                          <TrendBar level={productivityMeta.level} maxLevel={3} color={productivityMeta.color} />
                          <span className="text-sm leading-none" title={`Productivity: ${productivityMeta.label}`}>{productivityMeta.emoji}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-lr-muted/40">—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {!hasCurrentMood && !hasTrend && (
        <p className="text-xs text-lr-muted/60 italic">Submit your first check-in to start tracking your pulse.</p>
      )}
    </div>
  )
}
