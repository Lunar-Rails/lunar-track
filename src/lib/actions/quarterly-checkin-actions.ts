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
    submit: z.string().optional(),
  })

  const parsed = schema.safeParse({
    periodId: formData.get('periodId'),
    goals: formData.get('goals') || '[]',
    next_quarter_goals: formData.get('next_quarter_goals') || '[]',
    next_quarter_mits: formData.get('next_quarter_mits') || '[]',
    value_assessments: formData.get('value_assessments') || '[]',
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
    updated_at: new Date().toISOString(),
  }
  if (isSubmit) payload.employee_submitted_at = new Date().toISOString()

  let checkinId: string
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('quarterly_checkins').update(payload).eq('id', existing.id)
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

