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
  // Defense-in-depth: middleware already redirects unauthenticated requests,
  // but this layout catches any edge cases (e.g. SSR without middleware).
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const profile = await getOrProvisionProfile(supabase, user)
  if (!profile) {
    redirect('/login')
  }

  // All users must complete onboarding before accessing any protected page
  if (!profile.is_onboarded) {
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
      // Inbox badge = direct reports not yet scored for the open period.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: openPeriodRaw } = await (supabase as any)
        .from('performance_periods').select('id').eq('status', 'open').limit(1).maybeSingle()
      if (openPeriodRaw) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: scoredRaw } = await (supabase as any)
          .from('quarterly_scores').select('employee_id')
          .in('employee_id', reportIds).eq('period_id', (openPeriodRaw as { id: string }).id)
        const scored = new Set(((scoredRaw ?? []) as { employee_id: string }[]).map((s) => s.employee_id))
        inboxCount = reportIds.filter((id) => !scored.has(id)).length
      }
    }
  }

  return <StandardLayout profile={profile} inboxCount={inboxCount}>{children}</StandardLayout>
}
