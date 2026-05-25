import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OrgChart from '@/components/org/OrgChart'
import type { Profile } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Org Chart · CiaoBob' }

export const dynamic = 'force-dynamic'

export default async function OrgPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profilesRaw } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const profiles = (profilesRaw ?? []) as Profile[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">Org Chart</h1>
        <p className="text-body text-lr-muted mt-1">
          {profiles.length} people across the organisation.
        </p>
      </div>

      <OrgChart profiles={profiles} currentUserId={user.id} />
    </div>
  )
}
