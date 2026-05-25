'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { CompanyValue, Profile } from '@/lib/types/database'


type ActionResult = { success: true } | { error: string }

async function verifyHRAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Profile | null> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single()
  const profile = data as Profile | null
  if (!profile || profile.role !== 'HR_ADMIN') return null
  return profile
}

export async function removeUser(userId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await verifyHRAdmin(supabase)
  if (!caller) return { error: 'Unauthorized: HR Admin access required' }

  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id === userId) return { error: 'You cannot deactivate your own account.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('deactivate_user', { target_user_id: userId })
  if (error) return { error: error.message }

  revalidatePath('/admin/settings')
  revalidatePath('/org')
  revalidatePath('/team')
  return { success: true }
}

// ─── Company Values ────────────────────────────────────────────────────────

export async function upsertCompanyValue(formData: FormData): Promise<ActionResult & { value?: CompanyValue }> {
  const supabase = await createClient()
  const caller = await verifyHRAdmin(supabase)
  if (!caller) return { error: 'Unauthorized: HR Admin access required' }

  const schema = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(100).trim(),
    description: z.string().max(500).trim().default(''),
    sort_order: z.coerce.number().int().min(0).default(0),
  })

  const parsed = schema.safeParse({
    id: formData.get('id') || undefined,
    name: formData.get('name'),
    description: formData.get('description') || '',
    sort_order: formData.get('sort_order') || 0,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { id, ...rest } = parsed.data

  if (id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('company_values').update(rest).eq('id', id).select().single()
    if (error) return { error: 'Failed to update value: ' + error.message }
    revalidatePath('/admin/values')
    return { success: true, value: data as CompanyValue }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('company_values').upsert(rest, { onConflict: 'name' }).select().single()
    if (error) return { error: 'Failed to create value: ' + error.message }
    revalidatePath('/admin/values')
    return { success: true, value: data as CompanyValue }
  }
}

export async function deleteCompanyValue(valueId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await verifyHRAdmin(supabase)
  if (!caller) return { error: 'Unauthorized: HR Admin access required' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('company_values').delete().eq('id', valueId)
  if (error) return { error: 'Failed to delete value: ' + error.message }
  revalidatePath('/admin/values')
  return { success: true }
}

export async function upsertPulseOption(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await verifyHRAdmin(supabase)
  if (!caller) return { error: 'Unauthorized: HR Admin access required' }

  const schema = z.object({
    id: z.string().uuid(),
    label: z.string().min(1, 'Label is required').max(50),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color'),
  })

  const parsed = schema.safeParse({
    id: formData.get('id'),
    label: formData.get('label'),
    color: formData.get('color'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('pulse_options')
    .update({ label: parsed.data.label, color: parsed.data.color })
    .eq('id', parsed.data.id)

  if (error) return { error: error.message }

  revalidatePath('/admin/settings')
  revalidatePath('/dashboard')
  revalidatePath('/checkins')
  return { success: true }
}
