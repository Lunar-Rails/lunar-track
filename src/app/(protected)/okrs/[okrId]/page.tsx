import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OkrForm from '@/components/okrs/OkrForm'
import DeleteGoalButton from '@/components/okrs/DeleteGoalButton'
import type { Okr, KeyResult, Initiative, PerformancePeriod } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: periodsRaw } = await (supabase as any).from('performance_periods').select('*')
  const periods = (periodsRaw ?? []) as PerformancePeriod[]
  const period = periods.find(p => p.id === okr.period_id)

  const isOwner = okr.employee_id === user.id
  const isDeleted = !!okr.deleted_at

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-kicker">{period?.name ?? 'Unknown Period'}</p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <h1 className="text-page-title">{okr.title}</h1>
        </div>
        {okr.description && (
          <p className="text-body text-lr-muted mt-2">{okr.description}</p>
        )}
        {isDeleted && (
          <p className="text-xs text-lr-error mt-2">This goal was deleted.</p>
        )}
      </div>

      {/* Edit form — only if owner and not deleted */}
      {isOwner && !isDeleted && <OkrForm periods={periods} existing={okr} />}

      {/* Delete button — only if owner and not deleted */}
      {isOwner && !isDeleted && (
        <div className="pt-2">
          <DeleteGoalButton okrId={okr.id} />
        </div>
      )}
    </div>
  )
}
