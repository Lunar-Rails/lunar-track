'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Profile, KeyResultProgressStatus } from '@/lib/types/database'

type ActionResult = { success: true } | { error: string }

const PROGRESS_STATUSES: readonly KeyResultProgressStatus[] = [
  'not_started',
  'in_progress',
  'on_track',
  'at_risk',
  'done',
] as const

async function getCallerProfile(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single()
  return data as Profile | null
}

/**
 * Authorize that the caller is the OKR owner (employee). Only the owning
 * employee can update progress — managers and HR Admins are read-only.
 * This enforces clean ownership: the employee reports progress, the manager
 * reviews and scores based on what's reported.
 */
async function authorizeOkrEdit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caller: Profile,
  okrId: string,
): Promise<{ employeeId: string; okrId: string } | { error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: okr } = await (supabase as any)
    .from('okrs')
    .select('id, employee_id')
    .eq('id', okrId)
    .single()
  if (!okr) return { error: 'OKR not found' }

  const employeeId = (okr as { employee_id: string }).employee_id

  // Only the OKR owner can edit progress.
  if (employeeId !== caller.id) {
    return { error: 'Only the employee can update their own OKR progress' }
  }
  return { employeeId, okrId }
}

const toggleInitiativeSchema = z.object({
  initiativeId: z.string().uuid(),
  completed: z.boolean(),
})

export async function toggleInitiativeCompleted(
  initiativeId: string,
  completed: boolean,
): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  const parsed = toggleInitiativeSchema.safeParse({ initiativeId, completed })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // Look up the owning OKR via key_result -> okr
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: init } = await (supabase as any)
    .from('initiatives')
    .select('id, key_result_id, key_results!inner(okr_id)')
    .eq('id', parsed.data.initiativeId)
    .single()
  if (!init) return { error: 'Initiative not found' }

  const okrId = (init as { key_results: { okr_id: string } }).key_results.okr_id

  const auth = await authorizeOkrEdit(supabase, caller, okrId)
  if ('error' in auth) return { error: auth.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('initiatives')
    .update({
      completed: parsed.data.completed,
      completed_at: parsed.data.completed ? new Date().toISOString() : null,
    })
    .eq('id', parsed.data.initiativeId)
  if (error) return { error: 'Failed to update initiative: ' + error.message }

  revalidatePath(`/okrs/${okrId}`)
  revalidatePath('/okrs')
  revalidatePath('/team')
  return { success: true }
}

const updateKrStatusSchema = z.object({
  keyResultId: z.string().uuid(),
  status: z.enum(['not_started', 'in_progress', 'on_track', 'at_risk', 'done']),
})

export async function updateKeyResultStatus(
  keyResultId: string,
  status: string,
): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }

  if (!PROGRESS_STATUSES.includes(status as KeyResultProgressStatus)) {
    return { error: 'Invalid status' }
  }

  const parsed = updateKrStatusSchema.safeParse({ keyResultId, status })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: kr } = await (supabase as any)
    .from('key_results')
    .select('id, okr_id')
    .eq('id', parsed.data.keyResultId)
    .single()
  if (!kr) return { error: 'Key result not found' }

  const okrId = (kr as { okr_id: string }).okr_id

  const auth = await authorizeOkrEdit(supabase, caller, okrId)
  if ('error' in auth) return { error: auth.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('key_results')
    .update({
      progress_status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.keyResultId)
  if (error) return { error: 'Failed to update KR status: ' + error.message }

  revalidatePath(`/okrs/${okrId}`)
  revalidatePath('/okrs')
  revalidatePath('/team')
  return { success: true }
}
