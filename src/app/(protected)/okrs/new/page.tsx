import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OkrForm from '@/components/okrs/OkrForm'
import type { PerformancePeriod } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const TYPE_META: Record<string, { title: string; description: string }> = {
  Deliverable: {
    title: 'New Deliverable',
    description: 'Define a concrete output or project commitment for this period.',
  },
  Goal: {
    title: 'New Goal',
    description: 'Define a personal or professional development goal for this period.',
  },
}

export default async function NewOkrPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const meta = TYPE_META[type ?? ''] ?? {
    title: 'New OKR',
    description: 'Define your objective and key results for this period.',
  }

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
        <h1 className="text-page-title">{meta.title}</h1>
        <p className="text-body text-lr-muted">No open performance period available. Contact your HR Admin.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-kicker">{openPeriod.name}</p>
        <h1 className="text-page-title mt-1">{meta.title}</h1>
        <p className="text-body text-lr-muted mt-1">{meta.description}</p>
      </div>
      <OkrForm periods={periods} defaultPeriodId={openPeriod.id} />
    </div>
  )
}
