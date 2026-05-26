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
  const { data: profileRaw, error: profileError } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (profileError) console.error('[settings] profile fetch failed:', profileError.message)
  const profile = profileRaw as Pick<Profile, 'full_name' | 'email' | 'role' | 'avatar_url' | 'job_title'> | null
  if (!profile) redirect('/dashboard')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (profileRaw as any)?.notification_prefs ?? {}
  const notifPrefs = {
    checkin_reminders: raw.checkin_reminders ?? true,
    review_reminders: raw.review_reminders ?? true,
    goal_status_updates: raw.goal_status_updates ?? true,
    checkin_reviewed: raw.checkin_reviewed ?? true,
    team_checkin_submitted: raw.team_checkin_submitted ?? true,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">Settings</h1>
      </div>
      <ProfileSettingsForm profile={profile} />
      <AppearanceSection />
      <NotificationsSection initialPrefs={notifPrefs} role={profile.role} />
    </div>
  )
}
