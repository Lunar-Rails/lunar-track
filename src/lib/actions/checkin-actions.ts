'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Profile, Checkin } from '@/lib/types/database'
import {
  notifyManagerCheckinSubmitted,
  notifyEmployeeCheckinReviewed,
} from '@/lib/notifications'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

type ActionResult = { success: true; id?: string } | { error: string }

async function getCallerProfile(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single()
  return data as Profile | null
}

const mitItemSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(500).default(''),
})

export async function upsertCheckinEmployee(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  const schema = z.object({
    periodId: z.string().uuid(),
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2020).max(2099),
    mits: z.string(), // JSON string of Mit[]
    done_well: z.string().max(3000).optional(),
    do_differently: z.string().max(3000).optional(),
    support_requests: z.string().max(3000).optional(),
    ai_builder: z.string().max(3000).optional(),
    submit: z.string().optional(),
  })

  const parsed = schema.safeParse({
    periodId: formData.get('periodId'),
    month: formData.get('month'),
    year: formData.get('year'),
    mits: formData.get('mits') || '[]',
    done_well: formData.get('done_well') || undefined,
    do_differently: formData.get('do_differently') || undefined,
    support_requests: formData.get('support_requests') || undefined,
    ai_builder: formData.get('ai_builder') || undefined,
    submit: formData.get('submit') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  let mits: { title: string; description: string }[]
  try {
    const raw = JSON.parse(parsed.data.mits)
    mits = z.array(mitItemSchema).parse(raw)
  } catch {
    return { error: 'Invalid MITs format' }
  }

  const isSubmit = parsed.data.submit === 'true'
  if (isSubmit && !parsed.data.ai_builder) {
    return { error: 'AI Builder field is required before submitting' }
  }
  if (isSubmit && !mits.some((m) => m.title.trim())) {
    return { error: 'At least one MIT is required before submitting' }
  }

  const payload: Record<string, unknown> = {
    employee_id: caller.id,
    period_id: parsed.data.periodId,
    month: parsed.data.month,
    year: parsed.data.year,
    mits,
    done_well: parsed.data.done_well ?? null,
    do_differently: parsed.data.do_differently ?? null,
    support_requests: parsed.data.support_requests ?? null,
    ai_builder: parsed.data.ai_builder ?? null,
    updated_at: new Date().toISOString(),
  }

  if (isSubmit) {
    payload.employee_submitted_at = new Date().toISOString()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('checkins')
    .select('id, employee_submitted_at')
    .eq('employee_id', caller.id)
    .eq('period_id', parsed.data.periodId)
    .eq('month', parsed.data.month)
    .eq('year', parsed.data.year)
    .maybeSingle()

  if (existing?.employee_submitted_at) {
    // Block any writes once submitted — including duplicate submit calls
    return { error: 'Check-in already submitted. Editing is not allowed.' }
  }

  let checkinId: string
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('checkins').update(payload).eq('id', existing.id)
    checkinId = existing.id
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newCheckin, error: insertError } = await (supabase as any)
      .from('checkins')
      .insert(payload)
      .select('id')
      .single()
    if (insertError) {
      if (insertError.code === '23505') return { error: 'A check-in for this month already exists' }
      return { error: 'Failed to create check-in: ' + insertError.message }
    }
    checkinId = (newCheckin as { id: string }).id
  }

  revalidatePath('/checkins')
  revalidatePath(`/checkins/${checkinId}`)
  revalidatePath('/dashboard')

  // Notify manager on submit
  if (isSubmit && caller.manager_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mgr } = await (supabase as any)
      .from('profiles').select('email, full_name').eq('id', caller.manager_id).single()
    if (mgr) {
      const { data: { user } } = await supabase.auth.getUser()
      void notifyManagerCheckinSubmitted({
        managerEmail: mgr.email,
        managerName: mgr.full_name,
        employeeName: caller.full_name ?? (user?.email ?? 'Employee'),
        month: MONTH_NAMES[parsed.data.month - 1],
        year: parsed.data.year,
        checkinId,
      })
    }
  }

  return { success: true, id: checkinId }
}

export async function upsertCheckinManager(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  if (caller.role !== 'MANAGER' && caller.role !== 'HR_ADMIN') {
    return { error: 'Only managers can fill in the post-meeting section' }
  }

  const schema = z.object({
    checkinId: z.string().uuid(),
    mgr_mit_notes: z.string().max(3000).optional(),
    mgr_done_well: z.string().max(3000).optional(),
    mgr_do_differently: z.string().max(3000).optional(),
    mgr_support_commitments: z.string().max(3000).optional(),
    mgr_next_mits: z.string().default('[]'), // JSON string of Mit[]
    submit: z.string().optional(),
  })

  const parsed = schema.safeParse({
    checkinId: formData.get('checkinId'),
    mgr_mit_notes: formData.get('mgr_mit_notes') || undefined,
    mgr_done_well: formData.get('mgr_done_well') || undefined,
    mgr_do_differently: formData.get('mgr_do_differently') || undefined,
    mgr_support_commitments: formData.get('mgr_support_commitments') || undefined,
    mgr_next_mits: formData.get('mgr_next_mits') || '[]',
    submit: formData.get('submit') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  let mgr_next_mits: { title: string; description: string }[]
  try {
    const raw = JSON.parse(parsed.data.mgr_next_mits)
    mgr_next_mits = z.array(mitItemSchema).parse(raw)
  } catch {
    return { error: 'Invalid next MITs format' }
  }

  // Verify checkin exists and employee submitted
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: checkinRaw } = await (supabase as any)
    .from('checkins')
    .select('*')
    .eq('id', parsed.data.checkinId)
    .single()
  const checkin = checkinRaw as Checkin | null
  if (!checkin) return { error: 'Check-in not found' }
  if (!checkin.employee_submitted_at) return { error: 'Employee must submit their section first' }
  if (checkin.manager_submitted_at) return { error: 'Manager section already submitted.' }

  // Verify caller is in the employee's management chain (HR_ADMIN bypasses this)
  if (caller.role !== 'HR_ADMIN') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from('org_closure')
      .select('*', { count: 'exact', head: true })
      .eq('ancestor_id', caller.id)
      .eq('descendant_id', checkin.employee_id)
      .gt('depth', 0)
    if (!count || count === 0) {
      return { error: 'Unauthorized: you are not this employee\'s manager' }
    }
  }

  const isSubmit = parsed.data.submit === 'true'
  const update: Record<string, unknown> = {
    mgr_mit_notes: parsed.data.mgr_mit_notes ?? null,
    mgr_done_well: parsed.data.mgr_done_well ?? null,
    mgr_do_differently: parsed.data.mgr_do_differently ?? null,
    mgr_support_commitments: parsed.data.mgr_support_commitments ?? null,
    mgr_next_mits,
    updated_at: new Date().toISOString(),
  }
  if (isSubmit) update.manager_submitted_at = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('checkins').update(update).eq('id', parsed.data.checkinId)

  revalidatePath(`/checkins/${parsed.data.checkinId}`)
  revalidatePath(`/team/${checkin.employee_id}`)
  revalidatePath('/inbox')

  // Notify employee when manager submits post-meeting notes
  if (isSubmit) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: emp } = await (supabase as any)
      .from('profiles').select('email, full_name').eq('id', checkin.employee_id).single()
    if (emp) {
      void notifyEmployeeCheckinReviewed({
        employeeEmail: emp.email,
        employeeName: emp.full_name,
        managerName: caller.full_name ?? caller.email,
        month: MONTH_NAMES[checkin.month - 1],
        year: checkin.year,
        checkinId: parsed.data.checkinId,
      })
    }
  }

  return { success: true }
}
