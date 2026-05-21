'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Profile, QuarterlyScore, AnnualScore } from '@/lib/types/database'

type ActionResult = { success: true; id?: string } | { error: string }

async function getCallerProfile(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single()
  return data as Profile | null
}

// ─── Quarterly Score ───────────────────────────────────────────────────────

export async function upsertQuarterlyScore(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }
  if (caller.role !== 'MANAGER' && caller.role !== 'HR_ADMIN') {
    return { error: 'Only managers can submit quarterly scores' }
  }

  const schema = z.object({
    employeeId: z.string().uuid(),
    periodId: z.string().uuid(),
    professional_mastery: z.coerce.number().int().min(1).max(5),
    okrs_stretch_goals: z.coerce.number().int().min(1).max(5),
    behaviours_values: z.coerce.number().int().min(1).max(5),
    professional_mastery_notes: z.string().max(3000).optional(),
    okrs_stretch_goals_notes: z.string().max(3000).optional(),
    behaviours_values_notes: z.string().max(3000).optional(),
    ai_builder_active: z.string().optional(),
    value_ratings: z.string().optional(),
  })

  const parsed = schema.safeParse({
    employeeId: formData.get('employeeId'),
    periodId: formData.get('periodId'),
    professional_mastery: formData.get('professional_mastery'),
    okrs_stretch_goals: formData.get('okrs_stretch_goals'),
    behaviours_values: formData.get('behaviours_values'),
    professional_mastery_notes: formData.get('professional_mastery_notes') || undefined,
    okrs_stretch_goals_notes: formData.get('okrs_stretch_goals_notes') || undefined,
    behaviours_values_notes: formData.get('behaviours_values_notes') || undefined,
    ai_builder_active: formData.get('ai_builder_active') || undefined,
    value_ratings: formData.get('value_ratings') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // Parse value_ratings JSON if provided
  let valueRatings: { value_id: string; value_name: string; rating: number; evidence: string }[] = []
  if (parsed.data.value_ratings) {
    try {
      const arr = JSON.parse(parsed.data.value_ratings)
      if (!Array.isArray(arr)) throw new Error('not an array')
      for (const item of arr) {
        if (
          typeof item !== 'object' || item === null ||
          typeof item.value_id !== 'string' ||
          typeof item.value_name !== 'string' ||
          typeof item.rating !== 'number' ||
          item.rating < 1 || item.rating > 5
        ) {
          return { error: 'Invalid value rating entry' }
        }
        valueRatings.push({
          value_id: item.value_id,
          value_name: item.value_name,
          rating: Math.round(item.rating),
          evidence: typeof item.evidence === 'string' ? item.evidence : '',
        })
      }
    } catch {
      return { error: 'Invalid value_ratings JSON' }
    }
  }

  // If we have value_ratings, recompute behaviours_values as the rounded average
  let behavioursValuesFinal = parsed.data.behaviours_values
  if (valueRatings.length > 0) {
    const sum = valueRatings.reduce((a, v) => a + v.rating, 0)
    behavioursValuesFinal = Math.max(1, Math.min(5, Math.round(sum / valueRatings.length)))
  }

  // Verify caller manages this employee (HR_ADMIN bypasses)
  if (caller.role !== 'HR_ADMIN') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: closureCheck } = await (supabase as any)
      .from('org_closure').select('depth')
      .eq('ancestor_id', caller.id).eq('descendant_id', parsed.data.employeeId).gt('depth', 0).maybeSingle()
    if (!closureCheck) return { error: "You are not this employee's manager" }
  }

  // AI Builder gate: without an active AI Builder project the B/V score is capped at 4
  const aiBuilderActive = parsed.data.ai_builder_active === 'true'
  if (!aiBuilderActive && behavioursValuesFinal > 4) {
    return { error: 'Behaviours/Values score cannot exceed 4 when AI Builder is not active this quarter.' }
  }

  const payload = {
    manager_id: caller.id,
    employee_id: parsed.data.employeeId,
    period_id: parsed.data.periodId,
    professional_mastery: parsed.data.professional_mastery,
    okrs_stretch_goals: parsed.data.okrs_stretch_goals,
    behaviours_values: behavioursValuesFinal,
    professional_mastery_notes: parsed.data.professional_mastery_notes ?? null,
    okrs_stretch_goals_notes: parsed.data.okrs_stretch_goals_notes ?? null,
    behaviours_values_notes: parsed.data.behaviours_values_notes ?? null,
    value_ratings: valueRatings,
    updated_at: new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('quarterly_scores')
    .select('id')
    .eq('manager_id', caller.id)
    .eq('employee_id', parsed.data.employeeId)
    .eq('period_id', parsed.data.periodId)
    .maybeSingle()

  let scoreId: string
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('quarterly_scores').update(payload).eq('id', existing.id)
    scoreId = existing.id
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newScore, error } = await (supabase as any)
      .from('quarterly_scores')
      .insert(payload)
      .select('id')
      .single()
    if (error) return { error: 'Failed to save score: ' + error.message }
    scoreId = (newScore as { id: string }).id
  }

  revalidatePath(`/team/${parsed.data.employeeId}`)
  revalidatePath(`/scoring/${parsed.data.employeeId}/${parsed.data.periodId}`)
  return { success: true, id: scoreId }
}

// ─── Toggle Score Visibility (HR Admin) ───────────────────────────────────

export async function toggleScoreVisibility(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller || caller.role !== 'HR_ADMIN') return { error: 'HR Admin only' }

  const schema = z.object({
    scoreId: z.string().uuid(),
    visible: z.string(),
  })
  const parsed = schema.safeParse({
    scoreId: formData.get('scoreId'),
    visible: formData.get('visible'),
  })
  if (!parsed.success) return { error: 'Invalid input' }

  const newVisible = parsed.data.visible === 'true'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('quarterly_scores')
    .update({ visible_to_employee: newVisible, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.scoreId)

  if (error) return { error: 'Failed to update visibility' }

  revalidatePath('/admin/scores')
  return { success: true }
}

// ─── Finalize Annual Score ─────────────────────────────────────────────────

export async function finalizeAnnualScore(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }
  if (caller.role !== 'MANAGER' && caller.role !== 'HR_ADMIN') {
    return { error: 'Only managers can finalize annual scores' }
  }

  const schema = z.object({
    employeeId: z.string().uuid(),
    year: z.coerce.number().int().min(2020).max(2099),
    final_professional_mastery: z.coerce.number().min(1).max(5).optional(),
    final_okrs_stretch_goals: z.coerce.number().min(1).max(5).optional(),
    final_behaviours_values: z.coerce.number().min(1).max(5).optional(),
    override_rationale: z.string().max(3000).optional(),
  })

  const parsed = schema.safeParse({
    employeeId: formData.get('employeeId'),
    year: formData.get('year'),
    final_professional_mastery: formData.get('final_professional_mastery') || undefined,
    final_okrs_stretch_goals: formData.get('final_okrs_stretch_goals') || undefined,
    final_behaviours_values: formData.get('final_behaviours_values') || undefined,
    override_rationale: formData.get('override_rationale') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // Verify caller manages this employee (HR_ADMIN bypasses)
  if (caller.role !== 'HR_ADMIN') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: closureCheck } = await (supabase as any)
      .from('org_closure').select('depth')
      .eq('ancestor_id', caller.id).eq('descendant_id', parsed.data.employeeId).gt('depth', 0).maybeSingle()
    if (!closureCheck) return { error: "You are not this employee's manager" }
  }

  // Compute averages from quarterly scores
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: avgsRaw } = await (supabase as any).rpc('compute_annual_averages', {
    p_employee_id: parsed.data.employeeId,
    p_year: parsed.data.year,
  })
  const avgs = (Array.isArray(avgsRaw) ? avgsRaw[0] : avgsRaw) as {
    avg_professional_mastery: number | null
    avg_okrs_stretch_goals: number | null
    avg_behaviours_values: number | null
    quarters_counted: number
  } | null

  const finalPM = parsed.data.final_professional_mastery ?? avgs?.avg_professional_mastery ?? null
  const finalOKR = parsed.data.final_okrs_stretch_goals ?? avgs?.avg_okrs_stretch_goals ?? null
  const finalBV = parsed.data.final_behaviours_values ?? avgs?.avg_behaviours_values ?? null

  const finalOverall =
    finalPM !== null && finalOKR !== null && finalBV !== null
      ? Math.round(((finalPM + finalOKR + finalBV) / 3) * 100) / 100
      : null

  const payload = {
    employee_id: parsed.data.employeeId,
    year: parsed.data.year,
    suggested_professional_mastery: avgs?.avg_professional_mastery ?? null,
    suggested_okrs_stretch_goals: avgs?.avg_okrs_stretch_goals ?? null,
    suggested_behaviours_values: avgs?.avg_behaviours_values ?? null,
    final_professional_mastery: finalPM,
    final_okrs_stretch_goals: finalOKR,
    final_behaviours_values: finalBV,
    final_overall: finalOverall,
    override_rationale: parsed.data.override_rationale ?? null,
    finalized_by: caller.id,
    finalized_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('annual_scores')
    .select('id')
    .eq('employee_id', parsed.data.employeeId)
    .eq('year', parsed.data.year)
    .maybeSingle()

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('annual_scores').update(payload).eq('id', existing.id)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('annual_scores').insert(payload)
    if (error) return { error: 'Failed to save annual score: ' + error.message }
  }

  revalidatePath(`/team/${parsed.data.employeeId}`)
  revalidatePath('/admin/scores')
  return { success: true }
}
