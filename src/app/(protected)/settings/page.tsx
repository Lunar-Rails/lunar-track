import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types/database'
import ProfileSettingsForm from '@/components/profile/ProfileSettingsForm'

export const metadata: Metadata = { title: 'Settings · LunarTrack' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any)
    .from('profiles')
    .select('full_name, email, role, avatar_url')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as Pick<Profile, 'full_name' | 'email' | 'role' | 'avatar_url'> | null
  if (!profile) redirect('/dashboard')

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-page-title">Settings</h1>
        <p className="text-body text-lr-muted mt-1">Update your profile information</p>
      </div>
      <ProfileSettingsForm profile={profile} />
    </div>
  )
}
