'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import type { Profile, ReviewMit, PlanMit } from '@/lib/types/database'
import {
  notifyManagerCheckinSubmitted,
  notifyManagerCheckinReopened,
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

  // Validate period is still open before allowing any write
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: period } = await (supabase as any)
    .from('performance_periods')
    .select('status')
    .eq('id', parsed.data.periodId)
    .single()
  if (!period || period.status !== 'open') {
    return { error: 'This performance period is no longer open.' }
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

  revalidatePath('/checkins')
  revalidatePath(`/checkins/${checkinId}`)
  revalidatePath('/dashboard')

  // Schedule background work after the response is sent — keeps submission fast
  if (isSubmit) {
    const employeeId = caller.id
    const managerId = caller.manager_id
    const employeeName = caller.full_name ?? caller.email
    const { month, year, periodId } = parsed.data

    after(async () => {
      // Carry next MITs to the following month's check-in (pre-fill)
      if (nextMits.some((m) => m.title.trim())) {
        await carryMitsToNextMonth(supabase, {
          employeeId,
          periodId,
          currentMonth: month,
          currentYear: year,
          nextMits,
        }).catch((err) => console.error('[checkin-actions] carryMits failed:', err))
      }

      // Notify manager
      if (managerId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: mgr } = await (supabase as any)
          .from('profiles').select('email, full_name, notification_prefs').eq('id', managerId).single()
        if (mgr && mgr.notification_prefs?.team_checkin_submitted !== false) {
          await notifyManagerCheckinSubmitted({
            managerEmail: mgr.email,
            managerName: mgr.full_name,
            employeeName,
            month: MONTH_NAMES[month - 1],
            year,
            checkinId,
          }).catch((err) => console.error('[checkin-actions] notification failed:', err))
        }
      }
    })
  }

  return { success: true, id: checkinId }
}

export async function upsertCheckinManager(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }
  if (caller.role !== 'MANAGER' && caller.role !== 'HR_ADMIN') {
    return { error: 'Only managers can add notes' }
  }

  const schema = z.object({
    checkinId: z.string().uuid(),
    mgr_mit_notes: z.string().max(3000).optional(),
    mgr_done_well: z.string().max(3000).optional(),
    mgr_do_differently: z.string().max(3000).optional(),
    mgr_support_commitments: z.string().max(3000).optional(),
    mgr_private_note: z.string().max(3000).optional(),
    submit: z.string().optional(),
  })

  const parsed = schema.safeParse({
    checkinId: formData.get('checkinId'),
    mgr_mit_notes: formData.get('mgr_mit_notes') || undefined,
    mgr_done_well: formData.get('mgr_done_well') || undefined,
    mgr_do_differently: formData.get('mgr_do_differently') || undefined,
    mgr_support_commitments: formData.get('mgr_support_commitments') || undefined,
    mgr_private_note: formData.get('mgr_private_note') || undefined,
    submit: formData.get('submit') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { checkinId, submit: submitFlag, ...fields } = parsed.data
  const isSubmit = submitFlag === 'true'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: checkin } = await (supabase as any)
    .from('checkins')
    .select('id, employee_id, month, year, employee_submitted_at, period_id')
    .eq('id', checkinId)
    .maybeSingle()

  if (!checkin) return { error: 'Check-in not found' }
  if (!checkin.employee_submitted_at) return { error: 'Employee has not submitted yet' }

  // Verify manager has access to this employee (HR_ADMIN can see all)
  if (caller.role === 'MANAGER') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: closure } = await (supabase as any)
      .from('org_closure').select('depth')
      .eq('ancestor_id', caller.id).eq('descendant_id', checkin.employee_id)
      .gt('depth', 0).maybeSingle()
    if (!closure) return { error: 'Not authorised to edit notes for this employee' }
  }

  const payload: Record<string, unknown> = {
    mgr_mit_notes: fields.mgr_mit_notes ?? null,
    mgr_done_well: fields.mgr_done_well ?? null,
    mgr_do_differently: fields.mgr_do_differently ?? null,
    mgr_support_commitments: fields.mgr_support_commitments ?? null,
    mgr_private_note: fields.mgr_private_note ?? null,
    updated_at: new Date().toISOString(),
  }
  if (isSubmit) payload.manager_submitted_at = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('checkins').update(payload).eq('id', checkinId)
  if (updateError) return { error: 'Failed to save notes: ' + updateError.message }

  revalidatePath(`/checkins/${checkinId}`)
  revalidatePath('/checkins')

  if (isSubmit) {
    const managerName = caller.full_name ?? caller.email
    const { month, year } = checkin

    after(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: emp } = await (supabase as any)
        .from('profiles').select('email, full_name').eq('id', checkin.employee_id).single()
      if (emp) {
        await notifyEmployeeCheckinReviewed({
          employeeEmail: emp.email,
          employeeName: emp.full_name,
          managerName,
          month: MONTH_NAMES[month - 1],
          year,
          checkinId,
        }).catch((err: unknown) => console.error('[checkin-actions] review notification failed:', err))
      }
    })
  }

  return { success: true, id: checkinId }
}

export async function reopenCheckin(checkinId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: checkin } = await (supabase as any)
    .from('checkins')
    .select('id, employee_id, period_id, month, year, employee_submitted_at')
    .eq('id', checkinId)
    .maybeSingle()

  if (!checkin) return { error: 'Check-in not found' }
  if (checkin.employee_id !== caller.id) return { error: 'Not authorised' }
  if (!checkin.employee_submitted_at) return { error: 'Check-in is not submitted yet' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: period } = await (supabase as any)
    .from('performance_periods')
    .select('status')
    .eq('id', checkin.period_id)
    .single()
  if (!period || period.status !== 'open') {
    return { error: 'This performance period is closed — check-in cannot be reopened.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('checkins')
    .update({ employee_submitted_at: null, updated_at: new Date().toISOString() })
    .eq('id', checkinId)
  if (updateError) return { error: 'Failed to reopen check-in: ' + updateError.message }

  revalidatePath('/checkins')
  revalidatePath(`/checkins/${checkinId}`)
  revalidatePath('/dashboard')

  // Notify manager (best-effort)
  if (caller.manager_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mgr } = await (supabase as any)
      .from('profiles').select('email, full_name').eq('id', caller.manager_id).single()
    if (mgr) {
      await notifyManagerCheckinReopened({
        managerEmail: mgr.email,
        managerName: mgr.full_name,
        employeeName: caller.full_name ?? caller.email,
        month: MONTH_NAMES[checkin.month - 1],
        year: checkin.year,
        checkinId,
      }).catch((err) => console.error('[checkin-actions] reopen notification failed:', err))
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

  // At year-end the next month belongs to a new period — look it up
  let nextPeriodId = periodId
  if (currentMonth === 12) {
    const { data: nextPeriod } = await supabase
      .from('performance_periods')
      .select('id')
      .eq('year', nextYear)
      .eq('status', 'open')
      .maybeSingle()
    if (nextPeriod) nextPeriodId = nextPeriod.id
  }

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
    .eq('period_id', nextPeriodId)
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
      period_id: nextPeriodId,
      month: nextMonth,
      year: nextYear,
      mits: carriedMits,
    })
  }
}

