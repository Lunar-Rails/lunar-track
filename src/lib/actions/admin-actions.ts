'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type { Profile } from '@/lib/types/database'

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

  // Prevent self-deletion
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id === userId) return { error: 'You cannot remove your own account.' }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    // Fallback: delete profile row only (user can re-create on next login)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('profiles').delete().eq('id', userId)
    if (error) return { error: 'Failed to remove user: ' + error.message }
    revalidatePath('/admin/users')
    return { success: true }
  }

  // Full auth deletion via service role
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) return { error: 'Failed to remove user: ' + error.message }

  revalidatePath('/admin/users')
  return { success: true }
}
