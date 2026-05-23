import Link from 'next/link'
import type { MoodEnergy, MoodProductivity, PulseOption } from '@/lib/types/database'
import { ENERGY_META, PRODUCTIVITY_META, ENERGY_OPTIONS, PRODUCTIVITY_OPTIONS } from '@/lib/constants/mood'

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
  pulseOptions?: PulseOption[]
}

// Default fallback Tailwind classes (used when no DB options available)
const ENERGY_CELL_DEFAULT: Record<MoodEnergy, string> = {
  terrible: 'bg-lr-error/60',
  meh:      'bg-lr-warning/60',
  okay:     'bg-lr-cyan/60',
  great:    'bg-lr-accent',
}

const PRODUCTIVITY_CELL_DEFAULT: Record<MoodProductivity, string> = {
  waste:     'bg-lr-error/50',
  fine:      'bg-lr-cyan/55',
  ludicrous: 'bg-lr-accent',
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function PulseCard({
  currentEnergy,
  currentProductivity,
  hasCheckinThisMonth,
  trend,
  pulseOptions = [],
}: PulseCardProps) {
  const currentMonth = new Date().getMonth() + 1
  const moodMap = new Map(trend.map((e) => [e.month, e]))
  const hasAnyData = trend.some((e) => e.mood_energy || e.mood_productivity)

  // Build option maps from DB data; fall back to defaults if not available
  const energyOptMap = new Map(pulseOptions.filter((o) => o.type === 'energy').map((o) => [o.slug, o]))
  const flowOptMap = new Map(pulseOptions.filter((o) => o.type === 'flow').map((o) => [o.slug, o]))

  function energyCellStyle(val: MoodEnergy): { className?: string; style?: React.CSSProperties } {
    const opt = energyOptMap.get(val)
    if (!opt) return { className: ENERGY_CELL_DEFAULT[val] }
    return { style: { backgroundColor: hexToRgba(opt.color, 0.65) } }
  }

  function flowCellStyle(val: MoodProductivity): { className?: string; style?: React.CSSProperties } {
    const opt = flowOptMap.get(val)
    if (!opt) return { className: PRODUCTIVITY_CELL_DEFAULT[val] }
    return { style: { backgroundColor: hexToRgba(opt.color, 0.65) } }
  }

  function energyLabel(val: MoodEnergy) {
    return energyOptMap.get(val)?.label ?? ENERGY_META[val].label
  }
  function flowLabel(val: MoodProductivity) {
    return flowOptMap.get(val)?.label ?? PRODUCTIVITY_META[val].label
  }

  return (
    <div className="rounded-[var(--radius-lr-lg)] overflow-hidden border border-lr-border shadow-[var(--shadow-lr-card)] bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.12),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(6,182,212,0.08),transparent_60%)] bg-lr-glass backdrop-blur-[8px]">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <p className="text-kicker">My Pulse</p>
        {hasAnyData && (
          <Link href="/checkins" className="text-xs text-lr-muted hover:text-lr-accent transition-colors">
            View check-ins →
          </Link>
        )}
      </div>

      <div className="px-6 pb-6 space-y-4">

        {/* Current month chips */}
        {hasCheckinThisMonth && (currentEnergy || currentProductivity) ? (
          <div className="flex gap-2 flex-wrap">
            {currentEnergy && (
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border bg-lr-accent/15 border-lr-accent/35 text-lr-accent">
                <span>{ENERGY_META[currentEnergy].emoji}</span>
                <span className="text-[10px] opacity-60 uppercase tracking-wide">Energy</span>
                <span>{energyLabel(currentEnergy)}</span>
              </div>
            )}
            {currentProductivity && (
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border bg-lr-cyan-dim border-lr-cyan/30 text-lr-cyan">
                <span>{PRODUCTIVITY_META[currentProductivity].emoji}</span>
                <span className="text-[10px] opacity-60 uppercase tracking-wide">Flow</span>
                <span>{flowLabel(currentProductivity)}</span>
              </div>
            )}
          </div>
        ) : !hasCheckinThisMonth ? (
          <div className="rounded-[var(--radius-lr)] border border-lr-border/50 bg-lr-surface/30 px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-lr-muted">Log your pulse in this month&apos;s check-in</p>
            <Link
              href="/checkins/new"
              className="shrink-0 rounded-[var(--radius-lr)] bg-lr-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-lr-accent/90 transition-colors"
            >
              Start →
            </Link>
          </div>
        ) : null}

        {/* 12-month matrix — same h-4 squares as My Values */}
        <div className="space-y-3">
          {/* Energy row */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-lr-text w-[150px] shrink-0">Energy</span>
            <div className="flex items-center gap-1 flex-1">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const val = moodMap.get(month)?.mood_energy ?? null
                const isCurrent = month === currentMonth
                const cs = val ? energyCellStyle(val) : null
                return (
                  <div
                    key={month}
                    title={val ? `${MONTH_NAMES[month - 1]} · ${energyLabel(val)} ${ENERGY_META[val].emoji}` : MONTH_NAMES[month - 1]}
                    className={[
                      'h-4 flex-1 rounded-[2px] transition-all',
                      cs ? (cs.className ?? '') : 'bg-lr-border/50',
                      isCurrent ? 'ring-1 ring-lr-accent/70 ring-offset-0' : '',
                    ].filter(Boolean).join(' ')}
                    style={cs?.style}
                  />
                )
              })}
            </div>
          </div>

          {/* Flow row */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-lr-text w-[150px] shrink-0">Flow</span>
            <div className="flex items-center gap-1 flex-1">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const val = moodMap.get(month)?.mood_productivity ?? null
                const isCurrent = month === currentMonth
                const cs = val ? flowCellStyle(val) : null
                return (
                  <div
                    key={month}
                    title={val ? `${MONTH_NAMES[month - 1]} · ${flowLabel(val)} ${PRODUCTIVITY_META[val].emoji}` : MONTH_NAMES[month - 1]}
                    className={[
                      'h-4 flex-1 rounded-[2px] transition-all',
                      cs ? (cs.className ?? '') : 'bg-lr-border/50',
                      isCurrent ? 'ring-1 ring-lr-accent/70 ring-offset-0' : '',
                    ].filter(Boolean).join(' ')}
                    style={cs?.style}
                  />
                )
              })}
            </div>
          </div>

          {/* Month labels — aligned under squares */}
          <div className="flex items-center gap-3">
            <span className="w-[150px] shrink-0" />
            <div className="flex items-center gap-1 flex-1">
              {MONTH_NAMES.map((name, i) => (
                <span
                  key={name}
                  className={[
                    'flex-1 text-[9px] text-center font-medium',
                    i + 1 === currentMonth ? 'text-lr-accent font-bold' : 'text-lr-muted/50',
                  ].join(' ')}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        {hasAnyData && (
          <div className="flex items-start gap-5 flex-wrap pt-2 border-t border-lr-border/40">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-lr-muted">Energy</span>
              <div className="flex items-center gap-2 flex-wrap">
                {ENERGY_OPTIONS.map((opt) => {
                  const cs = energyCellStyle(opt.value)
                  return (
                    <div key={opt.value} className="flex items-center gap-1">
                      <div
                        className={`w-2.5 h-2.5 rounded-[2px] ${cs.className?.split(' ')[0] ?? ''}`}
                        style={cs.style}
                      />
                      <span className="text-[9px] text-lr-muted/60">{energyLabel(opt.value)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-lr-muted">Flow</span>
              <div className="flex items-center gap-2 flex-wrap">
                {PRODUCTIVITY_OPTIONS.map((opt) => {
                  const cs = flowCellStyle(opt.value)
                  return (
                    <div key={opt.value} className="flex items-center gap-1">
                      <div
                        className={`w-2.5 h-2.5 rounded-[2px] ${cs.className?.split(' ')[0] ?? ''}`}
                        style={cs.style}
                      />
                      <span className="text-[9px] text-lr-muted/60">{flowLabel(opt.value)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {!hasAnyData && !hasCheckinThisMonth && (
          <p className="text-xs text-lr-muted/60 italic">Submit your first check-in to start tracking your pulse.</p>
        )}
      </div>
    </div>
  )
}
