import { createClient } from '@/lib/supabase/server'
import UsersTable from '@/components/admin/UsersTable'
import type { Profile } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profilesRaw } = await (supabase as any)
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })

  const profiles = (profilesRaw ?? []) as Profile[]
  const allUsers = profiles.map((p) => ({ id: p.id, full_name: p.full_name, email: p.email }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">Users</h1>
        <p className="text-body text-lr-muted mt-1">Manage roles and reporting lines</p>
      </div>
      <UsersTable users={profiles} allUsers={allUsers} />
    </div>
  )
}
