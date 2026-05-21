import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import AddEntryButton from '@/components/okrs/AddEntryButton'
import type { Okr, KeyResult, Initiative, PerformancePeriod } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  DRAFT:              'bg-lr-surface text-lr-muted border-lr-border',
  PENDING_REVIEW:     'bg-lr-gold-dim text-lr-gold border-lr-gold/20',
  APPROVED:           'bg-lr-success-dim text-lr-success border-lr-success/20',
  REVISION_REQUESTED: 'bg-lr-error-dim text-lr-error border-lr-error/20',
}

type OkrWithHierarchy = Okr & {
  key_results: (KeyResult & { initiatives: Initiative[] })[]
}

export default async function OkrsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okrsRaw } = await (supabase as any)
    .from('okrs')
    .select('*, key_results(*, initiatives(*))')
    .eq('employee_id', user.id)
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: periodsRaw } = await (supabase as any)
    .from('performance_periods')
    .select('*')
    .order('year', { ascending: false })
    .order('quarter', { ascending: false })

  const okrs = (okrsRaw ?? []) as OkrWithHierarchy[]
  const periods = (periodsRaw ?? []) as PerformancePeriod[]
  const periodMap = new Map(periods.map(p => [p.id, p]))
  const openPeriod = periods.find(p => p.status === 'open')

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title">OKR / Deliverables / Goals</h1>
          <p className="text-body text-lr-muted mt-1">Objectives, Deliverables & Goals</p>
        </div>
        {openPeriod && <AddEntryButton />}
      </div>

      {okrs.length === 0 ? (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-12 text-center">
          <p className="text-body text-lr-muted">No entries yet.</p>
          {openPeriod && (
            <div className="mt-4 flex justify-center">
              <AddEntryButton />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {okrs.map(okr => {
            const period = periodMap.get(okr.period_id)
            const sortedKRs = [...(okr.key_results ?? [])].sort((a, b) => a.sort_order - b.sort_order)
            const totalInitiatives = sortedKRs.reduce((sum, kr) => sum + (kr.initiatives?.length ?? 0), 0)

            return (
              <Link key={okr.id} href={`/okrs/${okr.id}`}>
                <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 hover:bg-lr-surface transition-colors cursor-pointer shadow-[var(--shadow-lr-card)]">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-kicker mb-1">{period?.name ?? 'Unknown Period'}</p>
                      <h3 className="text-card-title">{okr.title}</h3>
                      {okr.description && (
                        <p className="text-body text-lr-muted mt-1 line-clamp-1">{okr.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-xs ${STATUS_BADGE[okr.status] ?? ''}`}>
                      {okr.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  {/* Key results preview */}
                  {sortedKRs.length > 0 && (
                    <div className="space-y-1.5 border-t border-lr-border pt-3">
                      {sortedKRs.slice(0, 3).map((kr, i) => {
                        const krDone = (kr.initiatives ?? []).filter((init) => init.completed).length
                        const krTotal = kr.initiatives?.length ?? 0
                        return (
                          <div key={kr.id} className="flex items-start gap-2">
                            <span className="text-xs font-mono text-lr-accent mt-0.5 shrink-0">KR{i + 1}</span>
                            <p className="text-caption line-clamp-1 flex-1">{kr.title}</p>
                            {krTotal > 0 && (
                              <span className="text-xs text-lr-muted shrink-0">
                                {okr.status === 'APPROVED' ? `${krDone}/${krTotal} done` : `${krTotal} initiative${krTotal !== 1 ? 's' : ''}`}
                              </span>
                            )}
                          </div>
                        )
                      })}
                      {sortedKRs.length > 3 && (
                        <p className="text-caption text-lr-muted pl-6">+{sortedKRs.length - 3} more key results</p>
                      )}
                    </div>
                  )}

                  {okr.manager_comment && okr.status === 'REVISION_REQUESTED' && (
                    <div className="mt-3 rounded-[var(--radius-lr)] border border-lr-error/20 bg-lr-error-dim px-3 py-2">
                      <p className="text-xs font-medium text-lr-error mb-0.5">Manager feedback</p>
                      <p className="text-xs text-lr-error/80 line-clamp-2">{okr.manager_comment}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-lr-border">
                    <span className="text-caption text-lr-muted">{sortedKRs.length} KR{sortedKRs.length !== 1 ? 's' : ''}</span>
                    <span className="text-lr-border">·</span>
                    {okr.status === 'APPROVED' && totalInitiatives > 0 ? (
                      <span className="text-caption text-lr-muted">
                        {sortedKRs.reduce((sum, kr) => sum + (kr.initiatives ?? []).filter((i) => i.completed).length, 0)}/{totalInitiatives} initiatives done
                      </span>
                    ) : (
                      <span className="text-caption text-lr-muted">{totalInitiatives} initiative{totalInitiatives !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
