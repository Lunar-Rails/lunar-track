'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Profile, QuarterlyCheckin, PerformancePeriod, QuarterlyGoal, QuarterlyGoalReview, ValueAssessment, PlanMit, ReviewMit } from '@/lib/types/database'
import {
  notifyManagerCheckinSubmitted,
  notifyEmployeeCheckinReviewed,
} from '@/lib/notifications'

type ActionResult = { success: true; id?: string } | { error: string }

async function getCallerProfile(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single()
  return data as Profile | null
}

const goalReviewSchema = z.object({
  id: z.string(),
  title: z.string().max(300),
  description: z.string().max(1000).default(''),
  status: z.enum(['achieved', 'not_achieved']).nullable().default(null),
})

const nextGoalSchema = z.object({
  id: z.string(),
  title: z.string().max(300),
  description: z.string().max(1000).default(''),
})

const planMitSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(500).default(''),
  okr_id: z.string().nullable().default(null),
  okr_label: z.string().nullable().default(null),
})

const valueAssessmentSchema = z.object({
  value_id: z.string(),
  value_name: z.string(),
  description: z.string().max(2000).default(''),
})

export async function upsertQuarterlyCheckinEmployee(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  const schema = z.object({
    periodId: z.string().uuid(),
    goals: z.string().default('[]'),
    next_quarter_goals: z.string().default('[]'),
    next_quarter_mits: z.string().default('[]'),
    value_assessments: z.string().default('[]'),
    ai_builder_active: z.string().optional(),
    ai_builder_description: z.string().max(2000).optional(),
    submit: z.string().optional(),
  })

  const parsed = schema.safeParse({
    periodId: formData.get('periodId'),
    goals: formData.get('goals') || '[]',
    next_quarter_goals: formData.get('next_quarter_goals') || '[]',
    next_quarter_mits: formData.get('next_quarter_mits') || '[]',
    value_assessments: formData.get('value_assessments') || '[]',
    ai_builder_active: formData.get('ai_builder_active') || undefined,
    ai_builder_description: formData.get('ai_builder_description') || undefined,
    submit: formData.get('submit') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  let goals: QuarterlyGoalReview[]
  let nextQuarterGoals: QuarterlyGoal[]
  let nextQuarterMits: PlanMit[]
  let valueAssessments: ValueAssessment[]
  try {
    goals = z.array(goalReviewSchema).parse(JSON.parse(parsed.data.goals))
    nextQuarterGoals = z.array(nextGoalSchema).parse(JSON.parse(parsed.data.next_quarter_goals))
    nextQuarterMits = z.array(planMitSchema).parse(JSON.parse(parsed.data.next_quarter_mits))
    valueAssessments = z.array(valueAssessmentSchema).parse(JSON.parse(parsed.data.value_assessments))
  } catch {
    return { error: 'Invalid form data' }
  }

  const isSubmit = parsed.data.submit === 'true'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('quarterly_checkins')
    .select('id, employee_submitted_at')
    .eq('employee_id', caller.id)
    .eq('period_id', parsed.data.periodId)
    .maybeSingle()

  if (existing?.employee_submitted_at) {
    return { error: 'Quarterly check-in already submitted. Editing is not allowed.' }
  }

  const payload: Record<string, unknown> = {
    employee_id: caller.id,
    period_id: parsed.data.periodId,
    goals,
    next_quarter_goals: nextQuarterGoals,
    next_quarter_mits: nextQuarterMits,
    value_assessments: valueAssessments,
    ai_builder_active: parsed.data.ai_builder_active === 'true',
    ai_builder_description: parsed.data.ai_builder_description ?? null,
    updated_at: new Date().toISOString(),
  }
  if (isSubmit) payload.employee_submitted_at = new Date().toISOString()

  let checkinId: string
  if (existing) {
    // Use conditional update to guard against double-submit race condition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any).from('quarterly_checkins').update(payload).eq('id', existing.id)
    if (isSubmit) query = query.is('employee_submitted_at', null)
    const { error: updateError, count } = await query.select('id')
    if (updateError) return { error: 'Failed to save quarterly check-in: ' + updateError.message }
    if (isSubmit && count === 0) return { error: 'Quarterly check-in already submitted. Editing is not allowed.' }
    checkinId = existing.id
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newCheckin, error: insertError } = await (supabase as any)
      .from('quarterly_checkins').insert(payload).select('id').single()
    if (insertError) {
      if (insertError.code === '23505') return { error: 'A quarterly check-in for this period already exists' }
      return { error: 'Failed to create quarterly check-in: ' + insertError.message }
    }
    checkinId = (newCheckin as { id: string }).id
  }

  // Sync next quarter goals to okrs table whenever there are goals to save
  if (nextQuarterGoals.length > 0) {
    await syncNextQuarterGoalsToOkrs(supabase, {
      employeeId: caller.id,
      currentPeriodId: parsed.data.periodId,
      nextQuarterGoals,
    })
  }

  if (isSubmit && nextQuarterMits.some((m) => m.title.trim())) {
    await carryMitsToFirstMonthOfNextQuarter(supabase, {
      employeeId: caller.id,
      currentPeriodId: parsed.data.periodId,
      nextQuarterMits,
    })
  }

  revalidatePath('/checkins')
  revalidatePath('/quarterly-checkins')
  revalidatePath(`/quarterly-checkins/${checkinId}`)
  revalidatePath('/dashboard')
  revalidatePath('/okrs')

  if (isSubmit && caller.manager_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: periodRaw } = await (supabase as any)
      .from('performance_periods').select('year, quarter').eq('id', parsed.data.periodId).single()
    const period = periodRaw as Pick<PerformancePeriod, 'year' | 'quarter'> | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mgr } = await (supabase as any)
      .from('profiles').select('email, full_name').eq('id', caller.manager_id).single()
    if (mgr) {
      const { data: { user } } = await supabase.auth.getUser()
      void notifyManagerCheckinSubmitted({
        managerEmail: mgr.email,
        managerName: mgr.full_name,
        employeeName: caller.full_name ?? (user?.email ?? 'Employee'),
        month: period ? `Q${period.quarter}` : 'Quarterly',
        year: period?.year ?? new Date().getFullYear(),
        checkinId,
      })
    }
  }

  return { success: true, id: checkinId }
}

async function carryMitsToFirstMonthOfNextQuarter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: { employeeId: string; currentPeriodId: string; nextQuarterMits: PlanMit[] }
) {
  const { employeeId, currentPeriodId, nextQuarterMits } = opts

  const { data: currentPeriod } = await supabase
    .from('performance_periods').select('year, quarter').eq('id', currentPeriodId).single()
  if (!currentPeriod) return

  const nextQuarter = currentPeriod.quarter === 4 ? 1 : currentPeriod.quarter + 1
  const nextYear = currentPeriod.quarter === 4 ? currentPeriod.year + 1 : currentPeriod.year

  const { data: nextPeriod } = await supabase
    .from('performance_periods')
    .select('id')
    .eq('year', nextYear)
    .eq('quarter', nextQuarter)
    .maybeSingle()
  if (!nextPeriod) return

  const carriedMits: ReviewMit[] = nextQuarterMits.map((m) => ({
    title: m.title,
    description: m.description,
    okr_id: m.okr_id,
    okr_label: m.okr_label,
    status: 'not_achieved' as const,
  }))

  const { data: firstMonthCheckin } = await supabase
    .from('checkins')
    .select('id, employee_submitted_at')
    .eq('employee_id', employeeId)
    .eq('period_id', nextPeriod.id)
    .eq('month', 1)
    .maybeSingle()

  if (firstMonthCheckin) {
    if (!firstMonthCheckin.employee_submitted_at) {
      await supabase.from('checkins')
        .update({ mits: carriedMits, updated_at: new Date().toISOString() })
        .eq('id', firstMonthCheckin.id)
    }
  } else {
    await supabase.from('checkins').insert({
      employee_id: employeeId,
      period_id: nextPeriod.id,
      month: 1,
      year: nextYear,
      mits: carriedMits,
    })
  }
}

export async function deleteQuarterlyCheckin(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  const checkinId = formData.get('checkinId')?.toString()
  if (!checkinId) return { error: 'Missing checkin ID' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('quarterly_checkins')
    .select('employee_id, employee_submitted_at')
    .eq('id', checkinId)
    .maybeSingle()

  if (!existing || existing.employee_id !== caller.id) return { error: 'Check-in not found' }
  if (existing.employee_submitted_at) return { error: 'Cannot delete a submitted check-in' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('quarterly_checkins')
    .delete()
    .eq('id', checkinId)
    .eq('employee_id', caller.id)

  if (error) return { error: error.message }

  revalidatePath('/quarterly-checkins')
  revalidatePath('/dashboard')
  return { success: true }
}

async function syncNextQuarterGoalsToOkrs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: { employeeId: string; currentPeriodId: string; nextQuarterGoals: QuarterlyGoal[] }
) {
  const { employeeId, currentPeriodId, nextQuarterGoals } = opts

  // Find the next period
  const { data: currentPeriod } = await supabase
    .from('performance_periods').select('year, quarter').eq('id', currentPeriodId).single()
  if (!currentPeriod) return

  const nextQuarter = currentPeriod.quarter === 4 ? 1 : currentPeriod.quarter + 1
  const nextYear = currentPeriod.quarter === 4 ? currentPeriod.year + 1 : currentPeriod.year

  const { data: nextPeriod } = await supabase
    .from('performance_periods')
    .select('id')
    .eq('year', nextYear)
    .eq('quarter', nextQuarter)
    .maybeSingle()
  if (!nextPeriod) return

  // Fetch existing OKRs for next period so we can decide insert vs update
  const { data: existingOkrs } = await supabase
    .from('okrs')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('period_id', nextPeriod.id)
    .is('deleted_at', null)

  const existingIds = new Set((existingOkrs ?? []).map((o: { id: string }) => o.id))
  const incomingIds = new Set(nextQuarterGoals.map((g) => g.id))

  // Soft-delete OKRs that were removed from the form
  const toDelete = ([...existingIds] as string[]).filter((id) => !incomingIds.has(id))
  if (toDelete.length > 0) {
    await supabase.from('okrs')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', toDelete)
      .eq('employee_id', employeeId)
  }

  // Upsert each goal as an OKR using the goal's id as the OKR id.
  // Only reset deleted_at for new goals (no conflict) — do not un-delete
  // an OKR that was explicitly soft-deleted.
  for (const goal of nextQuarterGoals) {
    if (!goal.title.trim()) continue
    const isNew = !existingIds.has(goal.id)
    await supabase.from('okrs').upsert({
      id: goal.id,
      employee_id: employeeId,
      period_id: nextPeriod.id,
      title: goal.title.trim(),
      description: goal.description ?? '',
      ...(isNew ? { deleted_at: null } : {}),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
  }
}

