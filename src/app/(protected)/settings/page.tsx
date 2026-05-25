import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types/database'
import ProfileSettingsForm from '@/components/profile/ProfileSettingsForm'
import AppearanceSection from '@/components/settings/AppearanceSection'
import NotificationsSection from '@/components/settings/NotificationsSection'

export const metadata: Metadata = { title: 'Settings · CiaoBob' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any)
    .from('profiles')
    .select('full_name, email, role, avatar_url')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as Pick<Profile, 'full_name' | 'email' | 'role' | 'avatar_url'> | null
  if (!profile) redirect('/dashboard')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prefsRaw } = await (supabase as any)
    .from('profiles')
    .select('notification_prefs')
    .eq('id', user.id)
    .single()
  const notifPrefs: { checkin_reminders: boolean; review_reminders: boolean } =
    (prefsRaw as any)?.notification_prefs ?? { checkin_reminders: true, review_reminders: true }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">Settings</h1>
      </div>
      <ProfileSettingsForm profile={profile} />
      <AppearanceSection />
<NotificationsSection initialPrefs={notifPrefs} />
    </div>
  )
}
