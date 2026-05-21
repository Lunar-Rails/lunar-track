import { createClient } from '@/lib/supabase/server'
import OrgTree from '@/components/admin/OrgTree'
import type { Profile } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export default async function OrgPage() {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profilesRaw } = await (supabase as any)
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true })

  const profiles = (profilesRaw ?? []) as Profile[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">Org Chart</h1>
        <p className="text-body text-lr-muted mt-1">
          Reporting structure across the organisation. Assign managers on the Users page.
        </p>
      </div>

      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] shadow-[var(--shadow-lr-card)] overflow-hidden">
        <OrgTree profiles={profiles} />
      </div>
    </div>
  )
}
