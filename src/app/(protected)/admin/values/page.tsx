import { createClient } from '@/lib/supabase/server'
import CompanyValuesAdmin from '@/components/admin/CompanyValuesAdmin'
import type { CompanyValue } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export default async function AdminValuesPage() {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('company_values')
    .select('*')
    .order('sort_order', { ascending: true })

  const values = (data ?? []) as CompanyValue[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">Company Values</h1>
        <p className="text-body text-lr-muted mt-1">
          These values appear in quarterly check-ins and scoring for all employees.
        </p>
      </div>
      <CompanyValuesAdmin initialValues={values} />
    </div>
  )
}
