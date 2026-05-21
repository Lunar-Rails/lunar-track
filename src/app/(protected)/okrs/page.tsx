import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import AddEntryButton from '@/components/okrs/AddEntryButton'
import type { Okr, PerformancePeriod } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  DRAFT:              'bg-lr-surface text-lr-muted border-lr-border',
  PENDING_REVIEW:     'bg-lr-gold-dim text-lr-gold border-lr-gold/20',
  APPROVED:           'bg-lr-success-dim text-lr-success border-lr-success/20',
  REVISION_REQUESTED: 'bg-lr-error-dim text-lr-error border-lr-error/20',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT:              'Draft',
  PENDING_REVIEW:     'Pending review',
  APPROVED:           'Approved',
  REVISION_REQUESTED: 'Revision needed',
}

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

  // Only show goals for the current open period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okrsRaw } = openPeriod ? await (supabase as any)
    .from('okrs')
    .select('id, title, description, status, manager_comment, created_at')
    .eq('employee_id', user.id)
    .eq('period_id', openPeriod.id)
    .order('created_at', { ascending: true }) : { data: [] }

  const okrs = (okrsRaw ?? []) as Pick<Okr, 'id' | 'title' | 'description' | 'status' | 'manager_comment' | 'created_at'>[]

  return (
    <div className="space-y-6 max-w-2xl">
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
      ) : okrs.length === 0 ? (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-12 text-center space-y-4">
          <p className="text-body text-lr-muted">No goals set for {openPeriod.name} yet.</p>
          <div className="flex justify-center">
            <AddEntryButton />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {okrs.map(okr => (
            <Link key={okr.id} href={`/okrs/${okr.id}`}>
              <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 hover:bg-lr-surface transition-colors cursor-pointer shadow-[var(--shadow-lr-card)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-card-title">{okr.title}</h3>
                    {okr.description && (
                      <p className="text-body text-lr-muted mt-1 line-clamp-2">{okr.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={`shrink-0 text-xs ${STATUS_BADGE[okr.status] ?? ''}`}>
                    {STATUS_LABEL[okr.status] ?? okr.status}
                  </Badge>
                </div>

                {okr.manager_comment && okr.status === 'REVISION_REQUESTED' && (
                  <div className="mt-3 rounded-[var(--radius-lr)] border border-lr-error/20 bg-lr-error-dim px-3 py-2">
                    <p className="text-xs font-medium text-lr-error mb-0.5">Manager feedback</p>
                    <p className="text-xs text-lr-error/80 line-clamp-2">{okr.manager_comment}</p>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
