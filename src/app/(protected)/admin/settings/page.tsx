import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import UsersTable from '@/components/admin/UsersTable'
import CompanyValuesAdmin from '@/components/admin/CompanyValuesAdmin'
import PulseOptionsAdmin from '@/components/admin/PulseOptionsAdmin'
import type { Profile, CompanyValue, PulseOption } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const TABS = [
  { id: 'users',  label: 'Users' },
  { id: 'values', label: 'Company Values' },
  { id: 'pulse',  label: 'Pulse' },
]

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function OrganizationSettingsPage({ searchParams }: PageProps) {
  const { tab = 'users' } = await searchParams
  const activeTab = TABS.some((t) => t.id === tab) ? tab : 'users'

  const supabase = await createClient()

  // Fetch data for the active tab only
  let profiles: Profile[] = []
  let companyValues: CompanyValue[] = []
  let pulseOptions: PulseOption[] = []
  let allUsers: { id: string; full_name: string | null; email: string }[] = []

  if (activeTab === 'users') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('profiles').select('*').order('created_at', { ascending: true })
    profiles = (data ?? []) as Profile[]
    allUsers = profiles.map((p) => ({ id: p.id, full_name: p.full_name, email: p.email }))
  }

  if (activeTab === 'values') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('company_values').select('*').order('sort_order', { ascending: true })
    companyValues = (data ?? []) as CompanyValue[]
  }

  if (activeTab === 'pulse') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('pulse_options').select('*').order('type').order('sort_order')
    pulseOptions = (data ?? []) as PulseOption[]
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-page-title">Organization Settings</h1>
        <p className="text-body text-lr-muted mt-1">Manage users, company values, and pulse configuration</p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-lr-border">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/settings?tab=${t.id}`}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === t.id
                ? 'border-lr-accent text-lr-accent'
                : 'border-transparent text-lr-muted hover:text-lr-text',
            ].join(' ')}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'users' && (
        <UsersTable users={profiles} allUsers={allUsers} />
      )}

      {activeTab === 'values' && (
        <CompanyValuesAdmin initialValues={companyValues} />
      )}

      {activeTab === 'pulse' && (
        <PulseOptionsAdmin options={pulseOptions} />
      )}
    </div>
  )
}
