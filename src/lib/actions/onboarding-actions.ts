'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { notifyEmployeeOnboardingApproved, notifyManagerInvite } from '@/lib/notifications'

type ActionResult = { success: true } | { error: string }

export async function submitOnboarding(params: {
  fullName: string
  managerId?: string
  inviteManagerEmail?: string
  goals: Array<{ title: string }>
}): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  const schema = z.object({
    fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
    managerId: z.string().uuid().optional(),
    inviteManagerEmail: z.string().email().optional(),
    goals: z.array(z.object({ title: z.string().min(1).max(200) })).min(1, 'Add at least one goal'),
  })

  const parsed = schema.safeParse(params)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { fullName, managerId, inviteManagerEmail, goals } = parsed.data

  let resolvedManagerId: string | null = managerId ?? null
  let pendingInviteEmail: string | null = null

  // If invite email provided (manager not in list), look up by email
  if (!resolvedManagerId && inviteManagerEmail) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: found } = await (supabase as any)
      .from('profiles')
      .select('id')
      .eq('email', inviteManagerEmail)
      .single()

    if (found) {
      resolvedManagerId = found.id
    } else {
      // Manager not in system yet — store email and send invite
      pendingInviteEmail = inviteManagerEmail
      try {
        await notifyManagerInvite({
          managerEmail: inviteManagerEmail,
          employeeName: fullName,
        })
      } catch {
        // non-blocking
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (supabase as any)
    .from('profiles')
    .update({
      full_name: fullName,
      pending_manager_id: resolvedManagerId,
      invited_manager_email: pendingInviteEmail,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (profileError) return { error: 'Failed to save: ' + profileError.message }

  // Create goals for the current open period (best-effort, non-blocking)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: periodRaw } = await (supabase as any)
      .from('performance_periods')
      .select('id')
      .eq('status', 'open')
      .single()

    if (periodRaw) {
      const periodId = (periodRaw as { id: string }).id
      await Promise.all(
        goals.map((g) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from('okrs').insert({
            employee_id: user.id,
            period_id: periodId,
            title: g.title,
            status: 'APPROVED',
          })
        )
      )
    }
  } catch {
    // goal creation failure must not block onboarding submission
  }

  revalidatePath('/onboarding')
  return { success: true }
}

export async function submitOnboardingDirect(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerRaw } = await (supabase as any).from('profiles').select('role, email').eq('id', user.id).single()
  if (!callerRaw || (callerRaw.role !== 'MANAGER' && callerRaw.role !== 'HR_ADMIN')) {
    return { error: 'Unauthorized' }
  }

  const schema = z.object({
    fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
    managerId: z.string().uuid().optional().or(z.literal('')),
  })

  const rawManagerId = formData.get('managerId')
  const parsed = schema.safeParse({
    fullName: formData.get('fullName'),
    managerId: (!rawManagerId || rawManagerId === 'none') ? undefined : rawManagerId,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('profiles')
    .update({
      full_name: parsed.data.fullName,
      manager_id: parsed.data.managerId || null,
      is_onboarded: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { error: 'Failed to save: ' + error.message }

  // Auto-link any employees who invited this manager by email before they were in the system
  try {
    const managerEmail = callerRaw.email as string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: waiting } = await (supabase as any)
      .from('profiles')
      .select('id')
      .eq('invited_manager_email', managerEmail)

    if (waiting && (waiting as { id: string }[]).length > 0) {
      await Promise.all(
        (waiting as { id: string }[]).map((emp) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from('profiles')
            .update({ pending_manager_id: user.id, invited_manager_email: null })
            .eq('id', emp.id)
        )
      )
    }
  } catch {
    // non-blocking
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
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
