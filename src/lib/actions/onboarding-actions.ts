'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { notifyEmployeeOnboardingApproved } from '@/lib/notifications'

type ActionResult = { success: true } | { error: string }

export async function submitOnboarding(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  const schema = z.object({
    fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
    managerId: z.string().uuid('Please select a manager'),
  })

  const parsed = schema.safeParse({
    fullName: formData.get('fullName'),
    managerId: formData.get('managerId'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('profiles')
    .update({
      full_name: parsed.data.fullName,
      pending_manager_id: parsed.data.managerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { error: 'Failed to save: ' + error.message }

  revalidatePath('/onboarding')
  return { success: true }
}

export async function approveTeamRequest(employeeId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerRaw } = await (supabase as any).from('profiles').select('role').eq('id', user.id).single()
  if (!callerRaw || (callerRaw.role !== 'MANAGER' && callerRaw.role !== 'HR_ADMIN')) {
    return { error: 'Unauthorized: Manager or HR Admin access required' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('approve_team_request', {
    employee_uuid: employeeId,
  })

  if (error) return { error: error.message }

  try {
    const [{ data: emp }, { data: mgr }] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('profiles').select('email, full_name').eq('id', employeeId).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('profiles').select('full_name').eq('id', user.id).single(),
    ])
    if (emp) {
      await notifyEmployeeOnboardingApproved({
        employeeEmail: emp.email,
        employeeName: emp.full_name,
        managerName: mgr?.full_name ?? 'Your manager',
      })
    }
  } catch {
    // notification failure must not block approval
  }

  revalidatePath('/dashboard')
  revalidatePath('/team')
  return { success: true }
}

export async function declineTeamRequest(employeeId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerRaw } = await (supabase as any).from('profiles').select('role').eq('id', user.id).single()
  if (!callerRaw || (callerRaw.role !== 'MANAGER' && callerRaw.role !== 'HR_ADMIN')) {
    return { error: 'Unauthorized: Manager or HR Admin access required' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('decline_team_request', {
    employee_uuid: employeeId,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}
