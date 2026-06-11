import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WeeklyCheckinForm from '@/components/checkins/WeeklyCheckinForm'
import { mondayOf } from '@/lib/week'

export const dynamic = 'force-dynamic'

const FMT = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export default async function NewWeeklyCheckinPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date()
  const weekStart = mondayOf(`${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('weekly_checkins').select('id').eq('employee_id', user.id).eq('week_start', weekStart).maybeSingle()
  if (existing) redirect(`/weekly-checkins/${existing.id}`)

  const now = new Date()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: monthly } = await (supabase as any)
    .from('checkins').select('mits').eq('employee_id', user.id).eq('month', now.getMonth() + 1).eq('year', now.getFullYear()).maybeSingle()
  const mitOptions = (((monthly?.mits ?? []) as { title: string }[]))
    .filter((m) => m.title?.trim()).map((m, i) => ({ id: `${i}:${m.title}`, label: m.title }))

  return (
    <div className="space-y-6">
      <div>
        <p className="text-kicker">Week of {FMT(weekStart)}</p>
        <h1 className="text-page-title mt-1">Weekly Check-in <span className="text-sm font-normal text-lr-muted">(Beta)</span></h1>
        <p className="text-body text-lr-muted mt-1">Progress · WIT · Problem</p>
      </div>
      <WeeklyCheckinForm weekStart={weekStart} existing={null} mitOptions={mitOptions} />
    </div>
  )
}
