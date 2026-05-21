'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Profile } from '@/lib/types/database'

type ActionResult = { success: true } | { error: string }
type SeedResult = { success: true; seeded: boolean } | { error: string }

async function verifyHRAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Profile | null> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single()
  const profile = data as Profile | null
  if (!profile || profile.role !== 'HR_ADMIN') return null
  return profile
}

export async function seedPeriodsForCurrentYear(): Promise<SeedResult> {
  const supabase = await createClient()
  // Only HR_ADMIN may trigger seeding
  const caller = await verifyHRAdmin(supabase)
  if (!caller) return { error: 'Unauthorized: HR Admin access required' }

  const now = new Date()
  const year = now.getFullYear()
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from('performance_periods')
    .select('*', { count: 'exact', head: true })
    .eq('year', year)

  if ((count ?? 0) > 0) {
    return { success: true, seeded: false }
  }

  const quarters = [
    { quarter: 1, name: `Q1 ${year}`, start_date: `${year}-01-01`, end_date: `${year}-03-31` },
    { quarter: 2, name: `Q2 ${year}`, start_date: `${year}-04-01`, end_date: `${year}-06-30` },
    { quarter: 3, name: `Q3 ${year}`, start_date: `${year}-07-01`, end_date: `${year}-09-30` },
    { quarter: 4, name: `Q4 ${year}`, start_date: `${year}-10-01`, end_date: `${year}-12-31` },
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any)
    .from('performance_periods')
    .insert(quarters.map((q) => ({
      ...q,
      year,
      // Only the current quarter starts open; past/future quarters start closed
      status: q.quarter === currentQuarter ? ('open' as const) : ('closed' as const),
    })))

  if (insertError) return { error: 'Failed to seed periods: ' + insertError.message }

  revalidatePath('/admin/periods')
  return { success: true, seeded: true }
}

export async function createPeriod(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await verifyHRAdmin(supabase)
  if (!caller) return { error: 'Unauthorized: HR Admin access required' }

  const schema = z.object({
    name: z.string().min(1).max(100),
    year: z.coerce.number().int().min(2020).max(2099),
    quarter: z.coerce.number().int().min(1).max(4),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })

  const parsed = schema.safeParse({
    name: formData.get('name'),
    year: formData.get('year'),
    quarter: formData.get('quarter'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
  })
  if (!parsed.success) return { error: 'Invalid input: ' + parsed.error.issues[0]?.message }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any)
    .from('performance_periods')
    .insert({
      name: parsed.data.name,
      year: parsed.data.year,
      quarter: parsed.data.quarter,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      status: 'open',
    })

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: `A period for Q${parsed.data.quarter} ${parsed.data.year} already exists` }
    }
    return { error: 'Failed to create period: ' + insertError.message }
  }

  revalidatePath('/admin/periods')
  return { success: true }
}

export async function togglePeriodStatus(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await verifyHRAdmin(supabase)
  if (!caller) return { error: 'Unauthorized: HR Admin access required' }

  const schema = z.object({
    periodId: z.string().uuid(),
    currentStatus: z.enum(['open', 'closed']),
  })

  const parsed = schema.safeParse({
    periodId: formData.get('periodId'),
    currentStatus: formData.get('currentStatus'),
  })
  if (!parsed.success) return { error: 'Invalid input: ' + parsed.error.issues[0]?.message }

  const newStatus = parsed.data.currentStatus === 'open' ? 'closed' : 'open'

  // Guard: only one period may be open at a time
  if (newStatus === 'open') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from('performance_periods')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')
    if ((count ?? 0) > 0) {
      return { error: 'Another period is already open. Close it before opening this one.' }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('performance_periods')
    .update({ status: newStatus })
    .eq('id', parsed.data.periodId)

  if (updateError) return { error: 'Failed to update period status: ' + updateError.message }

  revalidatePath('/admin/periods')
  return { success: true }
}
