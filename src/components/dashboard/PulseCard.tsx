import Link from 'next/link'
import type { MoodEnergy, MoodProductivity } from '@/lib/types/database'
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
}

const ENERGY_CELL: Record<MoodEnergy, string> = {
  terrible: 'bg-red-500/50',
  meh:      'bg-amber-400/55',
  okay:     'bg-lr-cyan/55',
  great:    'bg-lr-accent shadow-[0_0_6px_rgba(124,92,252,0.4)]',
}

const PRODUCTIVITY_CELL: Record<MoodProductivity, string> = {
  waste:     'bg-red-500/45',
  fine:      'bg-lr-cyan/50',
  ludicrous: 'bg-lr-accent shadow-[0_0_6px_rgba(124,92,252,0.4)]',
}

export default function PulseCard({
  currentEnergy,
  currentProductivity,
  hasCheckinThisMonth,
  trend,
}: PulseCardProps) {
  const currentMonth = new Date().getMonth() + 1
  const moodMap = new Map(trend.map((e) => [e.month, e]))
  const hasAnyData = trend.some((e) => e.mood_energy || e.mood_productivity)

  return (
    <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)] space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-card-title">My Pulse</h2>
        {hasAnyData && (
          <Link href="/checkins" className="text-xs text-lr-muted hover:text-lr-accent transition-colors">
            View check-ins →
          </Link>
        )}
      </div>

      {/* Current month state */}
      {hasCheckinThisMonth && (currentEnergy || currentProductivity) ? (
        <div className="flex gap-2 flex-wrap">
          {currentEnergy && (
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border bg-lr-accent/15 border-lr-accent/35 text-violet-300">
              <span>{ENERGY_META[currentEnergy].emoji}</span>
              <span className="text-[10px] opacity-60 uppercase tracking-wide">Energy</span>
              <span>{ENERGY_META[currentEnergy].label}</span>
            </div>
          )}
          {currentProductivity && (
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border bg-lr-cyan-dim border-lr-cyan/30 text-lr-cyan">
              <span>{PRODUCTIVITY_META[currentProductivity].emoji}</span>
              <span className="text-[10px] opacity-60 uppercase tracking-wide">Flow</span>
              <span>{PRODUCTIVITY_META[currentProductivity].label}</span>
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

      {/* 12-month matrix */}
      {hasAnyData && (
        <>
          <div className="border-t border-lr-border/40" />
          <div className="space-y-2">
            {/* Energy row */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-lr-muted w-20 shrink-0">Energy</span>
              <div className="grid grid-cols-12 gap-1 flex-1">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                  const val = moodMap.get(month)?.mood_energy ?? null
                  const isCurrent = month === currentMonth
                  return (
                    <div
                      key={month}
                      title={val ? `${MONTH_NAMES[month - 1]} · ${ENERGY_META[val].label} ${ENERGY_META[val].emoji}` : MONTH_NAMES[month - 1]}
                      className={[
                        'aspect-square rounded-[3px] transition-transform hover:scale-125 cursor-default',
                        val ? ENERGY_CELL[val] : 'bg-white/[0.05] border border-white/[0.06]',
                        isCurrent ? 'outline outline-2 outline-offset-1 outline-lr-accent/60' : '',
                      ].filter(Boolean).join(' ')}
                    />
                  )
                })}
              </div>
            </div>

            {/* Flow / Productivity row */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-lr-muted w-20 shrink-0">Flow</span>
              <div className="grid grid-cols-12 gap-1 flex-1">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                  const val = moodMap.get(month)?.mood_productivity ?? null
                  const isCurrent = month === currentMonth
                  return (
                    <div
                      key={month}
                      title={val ? `${MONTH_NAMES[month - 1]} · ${PRODUCTIVITY_META[val].label} ${PRODUCTIVITY_META[val].emoji}` : MONTH_NAMES[month - 1]}
                      className={[
                        'aspect-square rounded-[3px] transition-transform hover:scale-125 cursor-default',
                        val ? PRODUCTIVITY_CELL[val] : 'bg-white/[0.05] border border-white/[0.06]',
                        isCurrent ? 'outline outline-2 outline-offset-1 outline-lr-accent/60' : '',
                      ].filter(Boolean).join(' ')}
                    />
                  )
                })}
              </div>
            </div>

            {/* Month labels */}
            <div className="flex items-center gap-3">
              <span className="w-20 shrink-0" />
              <div className="grid grid-cols-12 gap-1 flex-1">
                {MONTH_NAMES.map((name, i) => (
                  <span
                    key={name}
                    className={[
                      'text-[9px] text-center font-medium',
                      i + 1 === currentMonth ? 'text-lr-accent font-bold' : 'text-lr-muted/40',
                    ].join(' ')}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-start gap-5 flex-wrap pt-2 border-t border-lr-border/40">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-lr-muted">Energy</span>
              <div className="flex items-center gap-2 flex-wrap">
                {ENERGY_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-1">
                    <div className={`w-2.5 h-2.5 rounded-[2px] ${ENERGY_CELL[opt.value].split(' ')[0]}`} />
                    <span className="text-[9px] text-lr-muted/60">{opt.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-lr-muted">Flow</span>
              <div className="flex items-center gap-2 flex-wrap">
                {PRODUCTIVITY_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-1">
                    <div className={`w-2.5 h-2.5 rounded-[2px] ${PRODUCTIVITY_CELL[opt.value].split(' ')[0]}`} />
                    <span className="text-[9px] text-lr-muted/60">{opt.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {!hasAnyData && !hasCheckinThisMonth && (
        <p className="text-xs text-lr-muted/60 italic">Submit your first check-in to start tracking your pulse.</p>
      )}
    </div>
  )
}
