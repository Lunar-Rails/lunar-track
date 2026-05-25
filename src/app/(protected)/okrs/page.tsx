import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import AddEntryButton from '@/components/okrs/AddEntryButton'
import DeleteGoalButton from '@/components/okrs/DeleteGoalButton'
import type { Okr, PerformancePeriod } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Goals (OKRs) · CiaoBob' }

export const dynamic = 'force-dynamic'

export default async function OkrsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: periodsRaw } = await (supabase as any)
    .from('performance_periods')
    .select('*')
    .order('year', { ascending: false })
    .order('quarter', { ascending: false })

  const periods = (periodsRaw ?? []) as PerformancePeriod[]
  const openPeriod = periods.find(p => p.status === 'open')

  type OkrRow = Pick<Okr, 'id' | 'title' | 'description' | 'status' | 'manager_comment' | 'created_at' | 'deleted_at' | 'period_id'>

  // Active goals (not deleted)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeRaw } = openPeriod ? await (supabase as any)
    .from('okrs')
    .select('id, title, description, status, manager_comment, created_at, deleted_at, period_id')
    .eq('employee_id', user.id)
    .eq('period_id', openPeriod.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true }) : { data: [] }

  const activeOkrs = (activeRaw ?? []) as OkrRow[]

  // Deleted goals (all periods)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deletedRaw } = await (supabase as any)
    .from('okrs')
    .select('id, title, description, status, manager_comment, created_at, deleted_at, period_id')
    .eq('employee_id', user.id)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  const deletedOkrs = (deletedRaw ?? []) as OkrRow[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title">Goals</h1>
          <p className="text-body text-lr-muted mt-1">
            {openPeriod ? `Your goals for ${openPeriod.name}` : 'No active period'}
          </p>
        </div>
        {openPeriod && <AddEntryButton />}
      </div>

      {!openPeriod ? (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-12 text-center">
          <p className="text-body text-lr-muted">No active performance period right now.</p>
        </div>
      ) : activeOkrs.length === 0 ? (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-12 text-center space-y-4">
          <p className="text-body text-lr-muted">No goals set for {openPeriod.name} yet.</p>
          <div className="flex justify-center">
            <AddEntryButton />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {activeOkrs.map(okr => (
            <div key={okr.id} className="group flex items-start gap-3 rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 hover:bg-lr-surface transition-colors shadow-[var(--shadow-lr-card)]">
              <Link href={`/okrs/${okr.id}`} className="flex-1 min-w-0">
                <h3 className="text-card-title">{okr.title}</h3>
                {okr.description && (
                  <p className="text-body text-lr-muted mt-1 line-clamp-2">{okr.description}</p>
                )}
              </Link>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <DeleteGoalButton okrId={okr.id} iconOnly />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deleted goals log */}
      {deletedOkrs.length > 0 && (
        <div className="space-y-3">
          <p className="text-section-label text-lr-muted/60">Deleted goals</p>
          {deletedOkrs.map(okr => {
            const period = periods.find(p => p.id === okr.period_id)
            return (
              <div key={okr.id} className="rounded-[var(--radius-lr-lg)] border border-lr-border/40 bg-lr-surface/20 p-4 opacity-60">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {period && <p className="text-[10px] text-lr-muted/50 mb-0.5">{period.name}</p>}
                    <p className="text-sm font-medium text-lr-muted line-through">{okr.title}</p>
                    {okr.description && (
                      <p className="text-xs text-lr-muted/60 mt-0.5 line-clamp-1">{okr.description}</p>
                    )}
                  </div>
                  {okr.deleted_at && (
                    <span className="text-[10px] text-lr-muted/50 shrink-0">
                      Deleted {format(new Date(okr.deleted_at), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
