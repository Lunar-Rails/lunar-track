import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OkrForm from '@/components/okrs/OkrForm'
import OkrStatusActions from '@/components/okrs/OkrStatusActions'
import { Badge } from '@/components/ui/badge'
import {
  KrStatusPill,
  KrStatusSelect,
  InitiativeCheckbox,
} from '@/components/okrs/OkrProgressControls'
import type { Okr, KeyResult, Initiative, PerformancePeriod, Profile } from '@/lib/types/database'

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

export default async function OkrDetailPage({ params }: { params: Promise<{ okrId: string }> }) {
  const { okrId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okrRaw } = await (supabase as any)
    .from('okrs')
    .select('*, key_results(*, initiatives(*))')
    .eq('id', okrId)
    .single()

  if (!okrRaw) notFound()
  const okr = okrRaw as OkrWithHierarchy

  // Sort by sort_order
  okr.key_results = [...(okr.key_results ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  okr.key_results.forEach(kr => {
    kr.initiatives = [...(kr.initiatives ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerRaw } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single()
  const caller = callerRaw as Profile

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: periodsRaw } = await (supabase as any).from('performance_periods').select('*')
  const periods = (periodsRaw ?? []) as PerformancePeriod[]
  const period = periods.find(p => p.id === okr.period_id)

  const isOwner = okr.employee_id === user.id
  const canEdit = isOwner && (okr.status === 'DRAFT' || okr.status === 'REVISION_REQUESTED')

  // Only the OKR owner (employee) can update progress.
  // Managers and HR Admin view progress read-only — they review and score based on what the employee reports.
  const canEditProgress = okr.status === 'APPROVED' && isOwner

  // Aggregate initiative counts
  const allInitiatives = okr.key_results.flatMap((kr) => kr.initiatives)
  const totalInitiatives = allInitiatives.length
  const doneInitiatives = allInitiatives.filter((i) => i.completed).length
  const progressPct = totalInitiatives > 0 ? Math.round((doneInitiatives / totalInitiatives) * 100) : 0

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <p className="text-kicker">{period?.name ?? 'Unknown Period'}</p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <h1 className="text-page-title">{okr.title}</h1>
          <Badge variant="outline" className={`text-xs ${STATUS_BADGE[okr.status] ?? ''}`}>
            {okr.status.replace(/_/g, ' ')}
          </Badge>
        </div>
        {okr.description && (
          <p className="text-body text-lr-muted mt-2">{okr.description}</p>
        )}
      </div>

      {/* Manager comment */}
      {okr.manager_comment && (
        <div className={`rounded-[var(--radius-lr)] border px-4 py-3 ${
          okr.status === 'REVISION_REQUESTED'
            ? 'bg-red-50 border-red-200'
            : 'bg-lr-surface border-lr-border'
        }`}>
          <p className="text-xs font-semibold text-lr-muted mb-1">Manager comment</p>
          <p className="text-body">{okr.manager_comment}</p>
        </div>
      )}

      {/* Progress bar (only when approved so progress is meaningful) */}
      {okr.status === 'APPROVED' && totalInitiatives > 0 && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-section-label">Progress</p>
            <p className="text-caption text-lr-muted">
              {doneInitiatives} of {totalInitiatives} initiatives done · {progressPct}%
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-lr-surface">
            <div
              className="h-full bg-lr-accent transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Edit form or read-only view */}
      {canEdit ? (
        <OkrForm periods={periods} existing={okr} />
      ) : (
        <div className="space-y-4">
          {okr.key_results.map((kr, ki) => (
            <div
              key={kr.id}
              className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass overflow-hidden shadow-[var(--shadow-lr-card)]"
            >
              {/* KR header */}
              <div className="flex items-start gap-3 px-5 py-4 bg-lr-surface/60 border-b border-lr-border">
                <span className="text-xs font-mono font-bold text-lr-accent mt-0.5 shrink-0">KR{ki + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-card-title">{kr.title}</p>
                </div>
                <div className="shrink-0">
                  {canEditProgress ? (
                    <KrStatusSelect keyResultId={kr.id} status={kr.progress_status} />
                  ) : (
                    <KrStatusPill status={kr.progress_status} />
                  )}
                </div>
              </div>

              {/* Initiatives */}
              {kr.initiatives.length > 0 && (
                <ul className="divide-y divide-lr-border">
                  {kr.initiatives.map((init, ii) => (
                    <li key={init.id} className="flex items-start gap-3 px-5 py-3">
                      <InitiativeCheckbox
                        initiativeId={init.id}
                        completed={init.completed}
                        disabled={!canEditProgress}
                      />
                      <span className="text-section-label mt-0.5 w-5 shrink-0 text-center">{ii + 1}</span>
                      <p className={`text-body flex-1 ${init.completed ? 'line-through text-lr-muted' : ''}`}>
                        {init.title}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <OkrStatusActions okr={okr} caller={caller} />
    </div>
  )
}
