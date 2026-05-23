'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Profile, Okr, OkrStatus } from '@/lib/types/database'
import { notifyEmployeeOkrStatusChanged } from '@/lib/notifications'

type ActionResult = { success: true; id?: string } | { error: string }

const TRANSITIONS: Record<OkrStatus, { to: OkrStatus[]; role: 'owner' | 'manager' }[]> = {
  DRAFT:              [{ to: ['PENDING_REVIEW'], role: 'owner' }],
  PENDING_REVIEW:     [{ to: ['APPROVED', 'REVISION_REQUESTED'], role: 'manager' }],
  REVISION_REQUESTED: [{ to: ['PENDING_REVIEW'], role: 'owner' }],
  APPROVED:           [],
}

async function getCallerProfile(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single()
  return data as Profile | null
}

const okrPayloadSchema = z.object({
  periodId: z.string().uuid(),
  title: z.string().min(1, 'Goal title is required').max(200),
  description: z.string().max(2000).optional(),
  keyResults: z.array(z.object({
    title: z.string().min(1).max(200),
    initiatives: z.array(z.object({ title: z.string().min(1).max(200) })),
  })).optional().default([]),
})

export async function createOkr(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  const rawPayload = formData.get('payload')
  if (!rawPayload) return { error: 'Missing payload' }

  let parsed
  try {
    parsed = okrPayloadSchema.parse(JSON.parse(rawPayload as string))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid input'
    return { error: msg }
  }

  // Create the OKR (objective)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okr, error: okrError } = await (supabase as any)
    .from('okrs')
    .insert({
      employee_id: caller.id,
      period_id: parsed.periodId,
      title: parsed.title,
      description: parsed.description ?? null,
      status: 'APPROVED',
    })
    .select('id')
    .single()

  if (okrError) return { error: 'Failed to create objective: ' + okrError.message }
  const okrId = (okr as { id: string }).id

  // Batch-insert all key results at once to avoid partial-OKR states
  if (parsed.keyResults.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: krRows, error: krError } = await (supabase as any)
      .from('key_results')
      .insert(parsed.keyResults.map((kr, i) => ({ okr_id: okrId, title: kr.title, sort_order: i })))
      .select('id')

    if (krError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('okrs').delete().eq('id', okrId)
      return { error: 'Failed to save key results: ' + krError.message }
    }

    // Batch-insert all initiatives
    const allInitiatives = (krRows as { id: string }[]).flatMap((krRow, krIdx) =>
      parsed.keyResults[krIdx].initiatives.map((init, i) => ({
        key_result_id: krRow.id,
        title: init.title,
        sort_order: i,
      }))
    )
    if (allInitiatives.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: initError } = await (supabase as any).from('initiatives').insert(allInitiatives)
      if (initError) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('okrs').delete().eq('id', okrId)
        return { error: 'Failed to save initiatives: ' + initError.message }
      }
    }
  }

  revalidatePath('/okrs')
  revalidatePath('/dashboard')
  return { success: true, id: okrId }
}

export async function updateOkr(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  const okrId = formData.get('okrId') as string
  if (!okrId) return { error: 'Missing OKR id' }

  const rawPayload = formData.get('payload')
  if (!rawPayload) return { error: 'Missing payload' }

  let parsed
  try {
    parsed = okrPayloadSchema.parse(JSON.parse(rawPayload as string))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid input'
    return { error: msg }
  }

  // Verify ownership + editable status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okrRaw } = await (supabase as any).from('okrs').select('*').eq('id', okrId).single()
  const okr = okrRaw as Okr | null
  if (!okr || okr.employee_id !== caller.id) return { error: 'OKR not found' }
  if (okr.status !== 'DRAFT' && okr.status !== 'REVISION_REQUESTED') {
    return { error: 'Cannot edit an OKR that is pending review or approved' }
  }

  // Update objective
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: okrUpdateError } = await (supabase as any).from('okrs').update({
    title: parsed.title,
    description: parsed.description ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', okrId)
  if (okrUpdateError) return { error: 'Failed to update goal: ' + okrUpdateError.message }

  // Insert new key results first, then delete old ones — prevents data loss if inserts fail
  const newKrIds: string[] = []
  for (let krIdx = 0; krIdx < parsed.keyResults.length; krIdx++) {
    const kr = parsed.keyResults[krIdx]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: krRow, error: krError } = await (supabase as any)
      .from('key_results')
      .insert({ okr_id: okrId, title: kr.title, sort_order: krIdx })
      .select('id')
      .single()

    if (krError) return { error: 'Failed to save key result: ' + krError.message }
    const krId = (krRow as { id: string }).id
    newKrIds.push(krId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: initError } = await (supabase as any)
      .from('initiatives')
      .insert(kr.initiatives.map((init, i) => ({
        key_result_id: krId,
        title: init.title,
        sort_order: i,
      })))
    if (initError) return { error: 'Failed to save initiatives: ' + initError.message }
  }

  // Delete old key results (cascade deletes their initiatives)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deleteQuery = (supabase as any).from('key_results').delete().eq('okr_id', okrId)
  if (newKrIds.length > 0) {
    await deleteQuery.not('id', 'in', `(${newKrIds.join(',')})`)
  } else {
    await deleteQuery
  }

  revalidatePath(`/okrs/${okrId}`)
  revalidatePath('/okrs')
  return { success: true }
}

export async function deleteOkr(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  const okrId = formData.get('okrId') as string
  if (!okrId) return { error: 'Missing OKR id' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okrRaw } = await (supabase as any).from('okrs').select('employee_id, status').eq('id', okrId).single()
  const okr = okrRaw as { employee_id: string; status: OkrStatus } | null
  if (!okr || okr.employee_id !== caller.id) return { error: 'OKR not found' }
  if (okr.status === 'APPROVED' || okr.status === 'PENDING_REVIEW') {
    return { error: 'Cannot delete an OKR that is pending review or approved' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any).from('okrs').update({ deleted_at: new Date().toISOString() }).eq('id', okrId)
  if (deleteError) return { error: 'Failed to delete OKR: ' + deleteError.message }

  revalidatePath('/okrs')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function transitionOkrStatus(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  const schema = z.object({
    okrId: z.string().uuid(),
    toStatus: z.enum(['PENDING_REVIEW', 'APPROVED', 'REVISION_REQUESTED']),
    comment: z.string().max(2000).optional(),
  })

  const parsed = schema.safeParse({
    okrId: formData.get('okrId'),
    toStatus: formData.get('toStatus'),
    comment: formData.get('comment') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okrRaw } = await (supabase as any).from('okrs').select('*').eq('id', parsed.data.okrId).single()
  const okr = okrRaw as Okr | null
  if (!okr) return { error: 'OKR not found' }

  const validTransitions = TRANSITIONS[okr.status] ?? []
  const matchingTransition = validTransitions.find(t => t.to.includes(parsed.data.toStatus))
  if (!matchingTransition) return { error: `Cannot transition from ${okr.status} to ${parsed.data.toStatus}` }

  if (matchingTransition.role === 'owner' && okr.employee_id !== caller.id) {
    return { error: 'Only the OKR owner can perform this action' }
  }
  if (matchingTransition.role === 'manager') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: closureCheck } = await (supabase as any)
      .from('org_closure')
      .select('depth')
      .eq('ancestor_id', caller.id)
      .eq('descendant_id', okr.employee_id)
      .gt('depth', 0)
      .maybeSingle()
    if (!closureCheck) return { error: "You are not this employee's manager" }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: transitionError } = await (supabase as any).from('okrs').update({
    status: parsed.data.toStatus,
    manager_comment: parsed.data.comment ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', parsed.data.okrId)
  if (transitionError) return { error: 'Failed to update OKR status: ' + transitionError.message }

  revalidatePath(`/okrs/${parsed.data.okrId}`)
  revalidatePath('/okrs')
  revalidatePath('/team')
  revalidatePath('/inbox')
  revalidatePath('/dashboard')

  // Notify employee when manager approves or requests revision
  if (matchingTransition.role === 'manager' &&
      (parsed.data.toStatus === 'APPROVED' || parsed.data.toStatus === 'REVISION_REQUESTED')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: emp } = await (supabase as any)
      .from('profiles').select('email, full_name').eq('id', okr.employee_id).single()
    if (emp) {
      void notifyEmployeeOkrStatusChanged({
        employeeEmail: emp.email,
        employeeName: emp.full_name,
        okrTitle: okr.title,
        newStatus: parsed.data.toStatus,
        managerName: caller.full_name ?? caller.email,
        comment: parsed.data.comment,
      })
    }
  }

  return { success: true }
}
