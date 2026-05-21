import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OkrForm from '@/components/okrs/OkrForm'
import type { PerformancePeriod } from '@/lib/types/database'

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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-kicker">{openPeriod.name}</p>
        <h1 className="text-page-title mt-1">New Goal</h1>
        <p className="text-body text-lr-muted mt-1">What do you want to achieve this quarter?</p>
      </div>
      <OkrForm periods={periods} defaultPeriodId={openPeriod.id} />
    </div>
  )
}
