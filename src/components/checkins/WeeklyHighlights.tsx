import type { WeeklyCheckin } from '@/lib/types/database'

const FMT = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export default function WeeklyHighlights({
  weeks, monthlyMitTitles,
}: { weeks: WeeklyCheckin[]; monthlyMitTitles: string[] }) {
  if (weeks.length === 0) return null

  const issues = weeks.flatMap((w) => [
    ...(w.problems?.trim() ? [{ week: w.week_start, kind: 'Problem', text: w.problems!.trim() }] : []),
    ...(w.last_minute_requests?.trim() ? [{ week: w.week_start, kind: 'Last-minute', text: w.last_minute_requests!.trim() }] : []),
  ])
  const touched = new Set(weeks.flatMap((w) => w.plan_tasks.map((t) => t.mit_label).filter(Boolean) as string[]))

  return (
    <section className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-lr-text">Weekly highlights this month <span className="text-xs font-normal text-lr-muted">(Beta)</span></p>
        <p className="text-xs text-lr-text/50 mt-0.5">{weeks.length} weekly check-in{weeks.length !== 1 ? 's' : ''} logged</p>
      </div>

      <div className="space-y-1.5">
        <p className="text-caption text-lr-muted">Problems &amp; last-minute requests</p>
        {issues.length === 0 ? (
          <p className="text-xs text-lr-muted italic">None logged this month.</p>
        ) : (
          <ul className="space-y-1">
            {issues.map((it, i) => (
              <li key={i} className="text-xs text-lr-text/80">
                <span className="text-lr-muted">{FMT(it.week)} · {it.kind}:</span> {it.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      {monthlyMitTitles.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-caption text-lr-muted">MIT coverage by weekly plans</p>
          <div className="flex flex-wrap gap-2">
            {monthlyMitTitles.map((title) => {
              const hit = touched.has(title)
              return (
                <span key={title} className={[
                  'rounded-full px-2.5 py-1 text-[11px] border',
                  hit ? 'border-lr-success/40 bg-lr-success/10 text-lr-success' : 'border-lr-border bg-lr-surface text-lr-muted',
                ].join(' ')}>
                  {hit ? '✓ ' : '○ '}{title}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
