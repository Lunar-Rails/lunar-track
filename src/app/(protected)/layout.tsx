import { redirect } from 'next/navigation'
import { createClient, getOrProvisionProfile } from '@/lib/supabase/server'
import StandardLayout from '@/components/layout/StandardLayout'
import { ensureCurrentPeriod } from '@/lib/actions/period-actions'

export const dynamic = 'force-dynamic'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const profile = await getOrProvisionProfile(supabase, user)
  if (!profile) {
    redirect('/login')
  }

  // New employees must complete onboarding before accessing any protected page
  if (profile.role === 'EMPLOYEE' && !profile.is_onboarded) {
    redirect('/onboarding')
  }

  // Auto-create and auto-advance performance periods based on the calendar year
  await ensureCurrentPeriod()

  // Inbox badge count for managers/HR
  let inboxCount = 0
  if (profile.role === 'MANAGER' || profile.role === 'HR_ADMIN') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: subsRaw } = await (supabase as any).rpc('get_subordinates', { manager_uuid: user.id })
    const reportIds = ((subsRaw ?? []) as { id: string; depth: number }[])
      .filter((s) => s.depth === 1)
      .map((s) => s.id)

    if (reportIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: checkinCount } = await (supabase as any)
        .from('checkins')
        .select('*', { count: 'exact', head: true })
        .in('employee_id', reportIds)
        .not('employee_submitted_at', 'is', null)
        .is('manager_submitted_at', null)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: okrCountRaw } = await (supabase as any).rpc('get_pending_okr_count', { manager_uuid: user!.id })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: qCheckinCount } = await (supabase as any)
        .from('quarterly_checkins')
        .select('*', { count: 'exact', head: true })
        .in('employee_id', reportIds)
        .not('employee_submitted_at', 'is', null)
        .is('manager_submitted_at', null)

      inboxCount = (checkinCount ?? 0) + ((okrCountRaw as number) ?? 0) + (qCheckinCount ?? 0)
    }
  }

  return <StandardLayout profile={profile} inboxCount={inboxCount}>{children}</StandardLayout>
}
