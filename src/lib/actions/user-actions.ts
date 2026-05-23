'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Profile } from '@/lib/types/database'

type ActionResult = { success: true } | { error: string }

async function getCallerProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single()
  return data as Profile | null
}

export async function updateUserRole(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }
  if (caller.role !== 'HR_ADMIN') return { error: 'Unauthorized: HR Admin access required' }

  const schema = z.object({
    userId: z.string().uuid(),
    newRole: z.enum(['EMPLOYEE', 'MANAGER', 'HR_ADMIN']),
  })

  const parsed = schema.safeParse({
    userId: formData.get('userId'),
    newRole: formData.get('newRole'),
  })
  if (!parsed.success) return { error: 'Invalid input: ' + parsed.error.issues[0]?.message }

  if (parsed.data.userId === caller.id && parsed.data.newRole !== 'HR_ADMIN') {
    return { error: 'Cannot change your own role away from HR_ADMIN' }
  }

  // Prevent demoting the last HR_ADMIN
  if (parsed.data.newRole !== 'HR_ADMIN') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'HR_ADMIN')
      .neq('id', parsed.data.userId)
    if (count === 0) return { error: 'Cannot demote the last HR Admin. Promote another user first.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('profiles')
    .update({ role: parsed.data.newRole, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.userId)

  if (updateError) return { error: 'Failed to update role: ' + updateError.message }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function assignManager(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const caller = await getCallerProfile(supabase)
  if (!caller) return { error: 'Not authenticated' }
  if (caller.role !== 'HR_ADMIN') return { error: 'Unauthorized: HR Admin access required' }

  const schema = z.object({
    employeeId: z.string().uuid(),
    newManagerId: z.string().uuid().nullable(),
  })

  const rawManagerId = formData.get('newManagerId')
  const parsed = schema.safeParse({
    employeeId: formData.get('employeeId'),
    newManagerId: rawManagerId === '' || rawManagerId === null ? null : rawManagerId,
  })
  if (!parsed.success) return { error: 'Invalid input: ' + parsed.error.issues[0]?.message }

  const { employeeId, newManagerId } = parsed.data

  if (newManagerId !== null && newManagerId === employeeId) {
    return { error: 'Cannot assign employee as their own manager' }
  }

  // Cycle prevention: check if newManagerId is already a descendant of employeeId
  if (newManagerId !== null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cycleCheck } = await (supabase as any)
      .from('org_closure')
      .select('descendant_id')
      .eq('ancestor_id', employeeId)
      .eq('descendant_id', newManagerId)
      .maybeSingle()

    if (cycleCheck) {
      return {
        error: "Cannot assign: would create a circular reporting relationship. The selected manager is already in this employee's reporting chain."
      }
    }
  }

  // Update manager_id on profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (supabase as any)
    .from('profiles')
    .update({ manager_id: newManagerId, updated_at: new Date().toISOString() })
    .eq('id', employeeId)

  if (profileError) return { error: 'Failed to update manager: ' + profileError.message }

  // Rebuild closure table atomically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: closureError } = await (supabase as any).rpc('rebuild_closure_for_employee', {
    employee_uuid: employeeId,
    new_manager_uuid: newManagerId,
  })

  if (closureError) {
    console.error('[assignManager] closure rebuild failed:', closureError.message)
    return { error: 'Manager updated but org chart rebuild failed. Please contact an administrator.' }
  }

  revalidatePath('/admin/users')
  revalidatePath('/admin/org')
  return { success: true }
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const fullName = (formData.get('full_name') as string | null)?.trim() ?? ''
  if (!fullName) return { error: 'Display name cannot be empty.' }
  if (fullName.length > 100) return { error: 'Display name is too long.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('profiles')
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateNotificationPrefs(formData: FormData): Promise<ActionResult> {
  const checkinReminders = formData.get('checkin_reminders') === 'true'
  const reviewReminders = formData.get('review_reminders') === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('profiles')
    .update({
      notification_prefs: { checkin_reminders: checkinReminders, review_reminders: reviewReminders },
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}
