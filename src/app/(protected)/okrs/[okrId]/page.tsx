import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OkrForm from '@/components/okrs/OkrForm'
import { Badge } from '@/components/ui/badge'
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
  const { data: periodsRaw } = await (supabase as any).from('performance_periods').select('*')
  const periods = (periodsRaw ?? []) as PerformancePeriod[]
  const period = periods.find(p => p.id === okr.period_id)

  const isOwner = okr.employee_id === user.id
  const canEdit = isOwner

  return (
    <div className="space-y-6">
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

      {/* Edit form */}
      {canEdit && <OkrForm periods={periods} existing={okr} />}

    </div>
  )
}
