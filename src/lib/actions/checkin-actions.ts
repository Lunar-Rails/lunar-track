'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Profile, Checkin, ReviewMit, PlanMit } from '@/lib/types/database'
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

const reviewMitSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(500).default(''),
  okr_id: z.string().nullable().default(null),
  okr_label: z.string().nullable().default(null),
  status: z.enum(['achieved', 'not_achieved']).default('not_achieved'),
})

const planMitSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(500).default(''),
  okr_id: z.string().nullable().default(null),
  okr_label: z.string().nullable().default(null),
})

export async function upsertCheckinEmployee(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  const schema = z.object({
    periodId: z.string().uuid(),
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2020).max(2099),
    review_mits: z.string().default('[]'),
    next_mits: z.string().default('[]'),
    done_well: z.string().max(3000).optional(),
    do_differently: z.string().max(3000).optional(),
    mood_energy: z.enum(['terrible', 'meh', 'okay', 'great']).optional(),
    mood_productivity: z.enum(['waste', 'fine', 'ludicrous']).optional(),
    submit: z.string().optional(),
  })

  const parsed = schema.safeParse({
    periodId: formData.get('periodId'),
    month: formData.get('month'),
    year: formData.get('year'),
    review_mits: formData.get('review_mits') || '[]',
    next_mits: formData.get('next_mits') || '[]',
    done_well: formData.get('done_well') || undefined,
    do_differently: formData.get('do_differently') || undefined,
    mood_energy: formData.get('mood_energy') || undefined,
    mood_productivity: formData.get('mood_productivity') || undefined,
    submit: formData.get('submit') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  let reviewMits: ReviewMit[]
  let nextMits: PlanMit[]
  try {
    reviewMits = z.array(reviewMitSchema).parse(JSON.parse(parsed.data.review_mits))
    nextMits = z.array(planMitSchema).parse(JSON.parse(parsed.data.next_mits))
  } catch {
    return { error: 'Invalid MITs format' }
  }

  const isSubmit = parsed.data.submit === 'true'
  if (isSubmit && !reviewMits.some((m) => m.title.trim())) {
    return { error: 'At least one MIT is required before submitting' }
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
    return { error: 'Check-in already submitted. Editing is not allowed.' }
  }

  const payload: Record<string, unknown> = {
    employee_id: caller.id,
    period_id: parsed.data.periodId,
    month: parsed.data.month,
    year: parsed.data.year,
    mits: reviewMits,
    next_mits: nextMits,
    done_well: parsed.data.done_well ?? null,
    do_differently: parsed.data.do_differently ?? null,
    mood_energy: parsed.data.mood_energy ?? null,
    mood_productivity: parsed.data.mood_productivity ?? null,
    updated_at: new Date().toISOString(),
  }
  if (isSubmit) payload.employee_submitted_at = new Date().toISOString()

  let checkinId: string
  if (existing) {
    // Use conditional update to guard against double-submit race condition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any).from('checkins').update(payload).eq('id', existing.id)
    if (isSubmit) query = query.is('employee_submitted_at', null)
    const { error: updateError, count } = await query.select('id')
    if (updateError) return { error: 'Failed to save check-in: ' + updateError.message }
    if (isSubmit && count === 0) return { error: 'Check-in already submitted. Editing is not allowed.' }
    checkinId = existing.id
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newCheckin, error: insertError } = await (supabase as any)
      .from('checkins').insert(payload).select('id').single()
    if (insertError) {
      if (insertError.code === '23505') return { error: 'A check-in for this month already exists' }
      return { error: 'Failed to create check-in: ' + insertError.message }
    }
    checkinId = (newCheckin as { id: string }).id
  }

  if (isSubmit && nextMits.some((m) => m.title.trim())) {
    await carryMitsToNextMonth(supabase, {
      employeeId: caller.id,
      periodId: parsed.data.periodId,
      currentMonth: parsed.data.month,
      currentYear: parsed.data.year,
      nextMits,
    })
  }

  revalidatePath('/checkins')
  revalidatePath(`/checkins/${checkinId}`)
  revalidatePath('/dashboard')

  if (isSubmit && caller.manager_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mgr } = await (supabase as any)
      .from('profiles').select('email, full_name').eq('id', caller.manager_id).single()
    if (mgr) {
      const { data: { user } } = await supabase.auth.getUser()
      await notifyManagerCheckinSubmitted({
        managerEmail: mgr.email,
        managerName: mgr.full_name,
        employeeName: caller.full_name ?? (user?.email ?? 'Employee'),
        month: MONTH_NAMES[parsed.data.month - 1],
        year: parsed.data.year,
        checkinId,
      }).catch((err) => console.error('[checkin-actions] notification failed:', err))
    }
  }

  return { success: true, id: checkinId }
}

async function carryMitsToNextMonth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: {
    employeeId: string
    periodId: string
    currentMonth: number
    currentYear: number
    nextMits: PlanMit[]
  }
) {
  const { employeeId, periodId, currentMonth, currentYear, nextMits } = opts
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear

  const carriedMits: ReviewMit[] = nextMits.map((m) => ({
    title: m.title,
    description: m.description,
    okr_id: m.okr_id,
    okr_label: m.okr_label,
    status: 'not_achieved' as const,
  }))

  const { data: nextCheckin } = await supabase
    .from('checkins')
    .select('id, employee_submitted_at')
    .eq('employee_id', employeeId)
    .eq('period_id', periodId)
    .eq('month', nextMonth)
    .eq('year', nextYear)
    .maybeSingle()

  if (nextCheckin) {
    if (!nextCheckin.employee_submitted_at) {
      await supabase.from('checkins').update({ mits: carriedMits, updated_at: new Date().toISOString() }).eq('id', nextCheckin.id)
    }
  } else {
    await supabase.from('checkins').insert({
      employee_id: employeeId,
      period_id: periodId,
      month: nextMonth,
      year: nextYear,
      mits: carriedMits,
    })
  }
}

