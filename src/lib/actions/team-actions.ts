'use server'

import { createClient } from '@/lib/supabase/server'
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

  const parsed = inviteSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid email' }
  const { email } = parsed.data

  // invite_team_member RPC validates caller role, checks for duplicates, and
  // upserts a pending_invites row — all without needing a service role key.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error: rpcError } = await (supabase as any)
    .rpc('invite_team_member', { p_email: email })

  if (rpcError) return { error: rpcError.message }
  if (result?.error) return { error: result.error }

  // Fetch caller name for the notification email (best-effort)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: callerProfile } = await (supabase as any)
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  // Send invite notification via Mailtrap (no-ops silently if MAILTRAP_API_TOKEN not set)
  await notifyTeamMemberInvited({
    inviteeEmail: email,
    managerName: callerProfile?.full_name ?? callerProfile?.email ?? 'Your manager',
  })

  revalidatePath('/team')
  return { success: true, email }
}
