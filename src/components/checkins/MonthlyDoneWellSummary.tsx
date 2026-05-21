const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export interface MonthlyReflection {
  month: number
  year: number
  done_well: string | null
  do_differently: string | null
}

interface MonthlyDoneWellSummaryProps {
  reflections: MonthlyReflection[]
}

export default function MonthlyDoneWellSummary({ reflections }: MonthlyDoneWellSummaryProps) {
  const filtered = reflections.filter((r) => r.done_well || r.do_differently)

  if (filtered.length === 0) {
    return <p className="text-sm text-lr-muted italic">No monthly reflections found for this quarter yet.</p>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-green-400">Done well</p>
        <div className="space-y-2">
          {filtered.map((r, i) => r.done_well ? (
            <div key={i} className="border-l-2 border-lr-accent/40 pl-3">
              <p className="text-[10px] text-lr-muted mb-0.5">{MONTH_NAMES[r.month - 1]} {r.year}</p>
              <p className="text-xs text-lr-text">{r.done_well}</p>
            </div>
          ) : null)}
        </div>
      </div>
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Done differently</p>
        <div className="space-y-2">
          {filtered.map((r, i) => r.do_differently ? (
            <div key={i} className="border-l-2 border-red-400/40 pl-3">
              <p className="text-[10px] text-lr-muted mb-0.5">{MONTH_NAMES[r.month - 1]} {r.year}</p>
              <p className="text-xs text-lr-text">{r.do_differently}</p>
            </div>
          ) : null)}
        </div>
      </div>
    </div>
  )
}
