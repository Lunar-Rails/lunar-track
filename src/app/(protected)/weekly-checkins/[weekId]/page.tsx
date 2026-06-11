import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WeeklyCheckinForm from '@/components/checkins/WeeklyCheckinForm'
import type { WeeklyCheckin } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const FMT = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export default async function WeeklyCheckinDetailPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase as any).from('weekly_checkins').select('*').eq('id', weekId).maybeSingle()
  if (!row) notFound()
  const wc = row as WeeklyCheckin

  const isOwner = wc.employee_id === user.id

  const month = Number(wc.week_start.slice(5, 7))
  const year = Number(wc.week_start.slice(0, 4))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: monthly } = await (supabase as any)
    .from('checkins').select('mits').eq('employee_id', wc.employee_id).eq('month', month).eq('year', year).maybeSingle()
  const mitOptions = (((monthly?.mits ?? []) as { title: string }[]))
    .filter((m) => m.title?.trim()).map((m, i) => ({ id: `${i}:${m.title}`, label: m.title }))

  return (
    <div className="space-y-6">
      <div>
        <p className="text-kicker">Week of {FMT(wc.week_start)}</p>
        <h1 className="text-page-title mt-1">Weekly Check-in <span className="text-sm font-normal text-lr-muted">(Beta)</span></h1>
      </div>
      <WeeklyCheckinForm weekStart={wc.week_start} existing={wc} mitOptions={mitOptions} readOnly={!isOwner} />
    </div>
  )
}
