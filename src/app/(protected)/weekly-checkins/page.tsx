import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function WeeklyCheckinsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('weekly_checkins')
    .select('id, week_start, problems, plan_tasks')
    .eq('employee_id', user.id)
    .order('week_start', { ascending: false })
  const weeks = (data ?? []) as {
    id: string; week_start: string; problems: string | null
    plan_tasks: { title: string }[] | null
  }[]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-page-title">
            Weekly Check-ins <span className="text-sm font-normal text-lr-muted">(Beta)</span>
          </h1>
          <p className="text-body text-lr-muted mt-1">Progress · WIT · Problem — a quick weekly check-in</p>
        </div>
        <Link href="/weekly-checkins/new">
          <Button className="bg-lr-accent hover:bg-lr-accent/90 text-white text-sm">New weekly check-in</Button>
        </Link>
      </div>

      {weeks.length === 0 ? (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-12 text-center">
          <p className="text-body text-lr-muted">No weekly check-ins yet.</p>
          <p className="text-sm text-lr-muted mt-2">Start your first weekly check-in.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {weeks.map((w) => (
            <Link key={w.id} href={`/weekly-checkins/${w.id}`}>
              <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-4 hover:bg-lr-surface transition-colors">
                <p className="text-sm font-medium text-lr-text">
                  Week of {new Date(`${w.week_start}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                </p>
                {(() => {
                  const wits = (w.plan_tasks ?? []).map((t) => t.title).filter((s) => s?.trim())
                  return wits.length > 0 ? (
                    <p className="text-caption text-lr-accent mt-0.5 line-clamp-1">WIT: {wits.join(' · ')}</p>
                  ) : null
                })()}
                {w.problems?.trim() && (
                  <p className="text-caption text-lr-muted mt-0.5 line-clamp-1">⚠ {w.problems}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
