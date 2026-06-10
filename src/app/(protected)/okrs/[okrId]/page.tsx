import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import OkrForm from '@/components/okrs/OkrForm'
import DeleteGoalButton from '@/components/okrs/DeleteGoalButton'
import type { Okr, KeyResult, Initiative, PerformancePeriod } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

type OkrWithHierarchy = Okr & {
  key_results: (KeyResult & { initiatives: Initiative[] })[]
}

export default async function OkrDetailPage({ params, searchParams }: { params: Promise<{ okrId: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { okrId } = await params
  const { edit } = await searchParams
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
  const editing = isOwner && !isDeleted && edit === '1'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-kicker">{period?.name ?? 'Unknown Period'}</p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <h1 className="text-page-title">{okr.title}</h1>
          {isOwner && !isDeleted && !editing && (
            <Link href="/okrs/new" className="ml-auto">
              <Button variant="outline" size="sm" className="border-lr-accent text-lr-accent hover:bg-lr-accent-dim gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add another goal
              </Button>
            </Link>
          )}
        </div>
        {okr.description && !editing && (
          <p className="text-body text-lr-muted mt-2">{okr.description}</p>
        )}
        {isDeleted && (
          <p className="text-xs text-lr-error mt-2">This goal was deleted.</p>
        )}
      </div>

      {/* Edit form when ?edit=1; otherwise a read-only view with Edit / Delete actions */}
      {editing ? (
        <OkrForm periods={periods} existing={okr} />
      ) : isOwner && !isDeleted ? (
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/okrs/${okr.id}?edit=1`}>
            <Button variant="outline" className="border-lr-border text-lr-text hover:bg-lr-surface gap-1.5">
              <Pencil className="h-4 w-4" /> Edit goal
            </Button>
          </Link>
          <DeleteGoalButton okrId={okr.id} />
        </div>
      ) : null}
    </div>
  )
}
