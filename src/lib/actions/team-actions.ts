'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { notifyTeamMemberInvited } from '@/lib/notifications'

type ActionResult = { success: true; email: string } | { error: string }

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
})

export async function inviteTeamMember(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Caller must be a MANAGER or HR_ADMIN
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerProfile } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', user.id)
    .single()
  if (!callerProfile || (callerProfile.role !== 'MANAGER' && callerProfile.role !== 'HR_ADMIN')) {
    return { error: 'Only managers can invite team members.' }
  }

  const parsed = inviteSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid email' }
  const { email } = parsed.data

  // Prevent inviting yourself
  if (email === callerProfile.email) return { error: "You can't invite yourself." }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return { error: 'Invitations require SUPABASE_SERVICE_ROLE_KEY to be configured.' }
  }

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Check if user already exists
  const { data: existingUsers } = await adminClient.auth.admin.listUsers()
  const existingAuthUser = existingUsers?.users?.find((u) => u.email === email)

  let newUserId: string

  if (existingAuthUser) {
    newUserId = existingAuthUser.id
    // Check if they already have a profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingProfile } = await (supabase as any)
      .from('profiles')
      .select('id, manager_id, full_name')
      .eq('id', existingAuthUser.id)
      .maybeSingle()
    if (existingProfile) {
      return { error: `${email} is already in the system.` }
    }
  } else {
    // Create auth user (Google OAuth will link on first login)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { provider: 'google', providers: ['google'] },
    })
    if (createError || !newUser.user) {
      return { error: 'Failed to create user: ' + (createError?.message ?? 'unknown error') }
    }
    newUserId = newUser.user.id
  }

  // Create profile with manager pre-assigned
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (supabase as any)
    .from('profiles')
    .insert({
      id: newUserId,
      email,
      role: 'EMPLOYEE',
      manager_id: user.id,
      is_onboarded: false,
    })
  if (profileError) {
    return { error: 'Failed to create profile: ' + profileError.message }
  }

  // Also insert org_closure self-row so hierarchy queries work
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('org_closure')
    .insert({ ancestor_id: newUserId, descendant_id: newUserId, depth: 0 })
    .onConflict('ancestor_id,descendant_id')

  // Send invite email via Resend
  await notifyTeamMemberInvited({
    inviteeEmail: email,
    managerName: callerProfile.full_name ?? callerProfile.email,
  })

  revalidatePath('/team')
  return { success: true, email }
}
