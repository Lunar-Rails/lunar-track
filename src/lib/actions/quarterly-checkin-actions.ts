'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Profile, QuarterlyCheckin, PerformancePeriod } from '@/lib/types/database'
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

export async function upsertQuarterlyCheckinEmployee(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  const schema = z.object({
    periodId: z.string().uuid(),
    okr_progress: z.string(), // JSON-stringified QuarterlyCheckinOkrProgress[]
    value_self_assessments: z.string().optional(),
    continue_doing: z.string().max(3000).optional(),
    stop_doing: z.string().max(3000).optional(),
    start_doing: z.string().max(3000).optional(),
    okr_adjustments: z.string().max(3000).optional(),
    capability_needs: z.string().max(3000).optional(),
    submit: z.string().optional(),
  })

  const parsed = schema.safeParse({
    periodId: formData.get('periodId'),
    okr_progress: formData.get('okr_progress') || '[]',
    value_self_assessments: formData.get('value_self_assessments') || undefined,
    continue_doing: formData.get('continue_doing') || undefined,
    stop_doing: formData.get('stop_doing') || undefined,
    start_doing: formData.get('start_doing') || undefined,
    okr_adjustments: formData.get('okr_adjustments') || undefined,
    capability_needs: formData.get('capability_needs') || undefined,
    submit: formData.get('submit') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // Parse value_self_assessments JSON
  let valueSelfAssessments: { value_id: string; value_name: string; rating: number; examples: string }[] = []
  if (parsed.data.value_self_assessments) {
    try {
      const arr = JSON.parse(parsed.data.value_self_assessments)
      if (!Array.isArray(arr)) throw new Error('not an array')
      for (const item of arr) {
        if (
          typeof item !== 'object' || item === null ||
          typeof item.value_id !== 'string' ||
          typeof item.value_name !== 'string' ||
          typeof item.rating !== 'number' ||
          item.rating < 1 || item.rating > 5
        ) {
          return { error: 'Invalid value self-assessment entry' }
        }
        valueSelfAssessments.push({
          value_id: item.value_id,
          value_name: item.value_name,
          rating: Math.round(item.rating),
          examples: typeof item.examples === 'string' ? item.examples : '',
        })
      }
    } catch {
      return { error: 'Invalid value_self_assessments JSON' }
    }
  }

  // Parse and validate okr_progress JSON
  // New schema: { okr_id, okr_title, narrative } — `status` field is deprecated and ignored.
  let okrProgressRaw: unknown[]
  try {
    okrProgressRaw = JSON.parse(parsed.data.okr_progress)
    if (!Array.isArray(okrProgressRaw)) throw new Error('not an array')
  } catch {
    return { error: 'Invalid OKR progress data' }
  }

  const okrProgress: { okr_id: string; okr_title: string; narrative: string }[] = []
  for (const item of okrProgressRaw) {
    if (
      typeof item !== 'object' || item === null ||
      typeof (item as Record<string, unknown>).okr_id !== 'string' ||
      typeof (item as Record<string, unknown>).okr_title !== 'string' ||
      typeof (item as Record<string, unknown>).narrative !== 'string'
    ) {
      return { error: 'Invalid OKR progress entry structure' }
    }
    const it = item as Record<string, unknown>
    okrProgress.push({
      okr_id: it.okr_id as string,
      okr_title: it.okr_title as string,
      narrative: it.narrative as string,
    })
  }

  const isSubmit = parsed.data.submit === 'true'
  if (isSubmit) {
    const hasNarrative = okrProgress.some(
      (item) => typeof (item as Record<string, unknown>).narrative === 'string' &&
        ((item as Record<string, unknown>).narrative as string).trim().length > 0
    )
    if (okrProgress.length === 0 || !hasNarrative) {
      return { error: 'At least one OKR entry with a narrative is required before submitting' }
    }
  }

  // Check existing record — block writes once submitted
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
    okr_progress: okrProgress,
    value_self_assessments: valueSelfAssessments,
    continue_doing: parsed.data.continue_doing ?? null,
    stop_doing: parsed.data.stop_doing ?? null,
    start_doing: parsed.data.start_doing ?? null,
    okr_adjustments: parsed.data.okr_adjustments ?? null,
    capability_needs: parsed.data.capability_needs ?? null,
    updated_at: new Date().toISOString(),
  }

  if (isSubmit) {
    payload.employee_submitted_at = new Date().toISOString()
  }

  let checkinId: string

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('quarterly_checkins').update(payload).eq('id', existing.id)
    checkinId = existing.id
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newCheckin, error: insertError } = await (supabase as any)
      .from('quarterly_checkins')
      .insert(payload)
      .select('id')
      .single()
    if (insertError) {
      if (insertError.code === '23505') return { error: 'A quarterly check-in for this period already exists' }
      return { error: 'Failed to create quarterly check-in: ' + insertError.message }
    }
    checkinId = (newCheckin as { id: string }).id
  }

  revalidatePath('/checkins')
  revalidatePath('/quarterly-checkins')
  revalidatePath(`/quarterly-checkins/${checkinId}`)
  revalidatePath('/dashboard')

  // Notify manager on submit
  if (isSubmit && caller.manager_id) {
    // Fetch period to get year
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: periodRaw } = await (supabase as any)
      .from('performance_periods')
      .select('year, quarter')
      .eq('id', parsed.data.periodId)
      .single()
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

export async function upsertQuarterlyCheckinManager(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  if (caller.role !== 'MANAGER' && caller.role !== 'HR_ADMIN') {
    return { error: 'Only managers can fill in the manager review section' }
  }

  const schema = z.object({
    checkinId: z.string().uuid(),
    mgr_okr_feedback: z.string().max(3000).optional(),
    mgr_css_feedback: z.string().max(3000).optional(),
    mgr_adjustments_notes: z.string().max(3000).optional(),
    mgr_support_plan: z.string().max(3000).optional(),
    submit: z.string().optional(),
  })

  const parsed = schema.safeParse({
    checkinId: formData.get('checkinId'),
    mgr_okr_feedback: formData.get('mgr_okr_feedback') || undefined,
    mgr_css_feedback: formData.get('mgr_css_feedback') || undefined,
    mgr_adjustments_notes: formData.get('mgr_adjustments_notes') || undefined,
    mgr_support_plan: formData.get('mgr_support_plan') || undefined,
    submit: formData.get('submit') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // Fetch the quarterly_checkin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: checkinRaw } = await (supabase as any)
    .from('quarterly_checkins')
    .select('*')
    .eq('id', parsed.data.checkinId)
    .single()
  const checkin = checkinRaw as QuarterlyCheckin | null
  if (!checkin) return { error: 'Quarterly check-in not found' }
  if (!checkin.employee_submitted_at) return { error: 'Employee must submit their section first' }
  if (checkin.manager_submitted_at) return { error: 'Manager section already submitted.' }

  // Org closure check for non-HR_ADMIN callers
  if (caller.role !== 'HR_ADMIN') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from('org_closure')
      .select('*', { count: 'exact', head: true })
      .eq('ancestor_id', caller.id)
      .eq('descendant_id', checkin.employee_id)
      .gt('depth', 0)
    if (!count || count === 0) {
      return { error: "Unauthorized: you are not this employee's manager" }
    }
  }

  const isSubmit = parsed.data.submit === 'true'
  const update: Record<string, unknown> = {
    mgr_okr_feedback: parsed.data.mgr_okr_feedback ?? null,
    mgr_css_feedback: parsed.data.mgr_css_feedback ?? null,
    mgr_adjustments_notes: parsed.data.mgr_adjustments_notes ?? null,
    mgr_support_plan: parsed.data.mgr_support_plan ?? null,
    updated_at: new Date().toISOString(),
  }
  if (isSubmit) update.manager_submitted_at = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('quarterly_checkins').update(update).eq('id', parsed.data.checkinId)

  revalidatePath(`/quarterly-checkins/${parsed.data.checkinId}`)
  revalidatePath('/inbox')

  // Notify employee when manager submits
  if (isSubmit) {
    // Fetch period info for label
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: periodRaw } = await (supabase as any)
      .from('performance_periods')
      .select('year, quarter')
      .eq('id', checkin.period_id)
      .single()
    const period = periodRaw as Pick<PerformancePeriod, 'year' | 'quarter'> | null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: emp } = await (supabase as any)
      .from('profiles').select('email, full_name').eq('id', checkin.employee_id).single()
    if (emp) {
      void notifyEmployeeCheckinReviewed({
        employeeEmail: emp.email,
        employeeName: emp.full_name,
        managerName: caller.full_name ?? caller.email,
        month: period ? `Q${period.quarter}` : 'Quarterly',
        year: period?.year ?? new Date().getFullYear(),
        checkinId: parsed.data.checkinId,
      })
    }
  }

  return { success: true }
}
