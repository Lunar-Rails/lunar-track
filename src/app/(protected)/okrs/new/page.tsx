import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import OkrForm from '@/components/okrs/OkrForm'
import type { Okr, PerformancePeriod } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export default async function NewGoalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: periodsRaw } = await (supabase as any)
    .from('performance_periods')
    .select('*')
    .order('year', { ascending: false })

  const periods = (periodsRaw ?? []) as PerformancePeriod[]
  const openPeriod = periods.find(p => p.status === 'open')

  if (!openPeriod) {
    return (
      <div className="space-y-4">
        <h1 className="text-page-title">New Goal</h1>
        <p className="text-body text-lr-muted">No open performance period. Contact your HR Admin.</p>
      </div>
    )
  }

  // Existing goals for the open period — shown so the user keeps context while adding.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: goalsRaw } = await (supabase as any)
    .from('okrs')
    .select('id, title, description')
    .eq('employee_id', user.id)
    .eq('period_id', openPeriod.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  const existingGoals = (goalsRaw ?? []) as Pick<Okr, 'id' | 'title' | 'description'>[]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-kicker">{openPeriod.name}</p>
        <h1 className="text-page-title mt-1">Goals</h1>
        <p className="text-body text-lr-muted mt-1">What do you want to achieve this quarter?</p>
      </div>

      {existingGoals.length > 0 && (
        <div className="space-y-2">
          <p className="text-section-label text-lr-muted">
            Your goals for {openPeriod.name} ({existingGoals.length})
          </p>
          <div className="flex flex-col gap-2">
            {existingGoals.map(g => (
              <Link
                key={g.id}
                href={`/okrs/${g.id}`}
                className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-4 hover:bg-lr-surface transition-colors"
              >
                <p className="text-sm font-medium text-lr-text">{g.title}</p>
                {g.description && (
                  <p className="text-xs text-lr-muted mt-0.5 line-clamp-2">{g.description}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-section-label text-lr-muted mb-2">
          {existingGoals.length > 0 ? 'Add another goal' : 'Add a goal'}
        </p>
        <OkrForm periods={periods} defaultPeriodId={openPeriod.id} afterCreate="stay" />
      </div>
    </div>
  )
}
