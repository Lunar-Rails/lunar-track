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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: okrCountRaw } = await (supabase as any).rpc('get_pending_okr_count', { manager_uuid: user!.id })
      inboxCount = (okrCountRaw as number) ?? 0
    }
  }

  return <StandardLayout profile={profile} inboxCount={inboxCount}>{children}</StandardLayout>
}
