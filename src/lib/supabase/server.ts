import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database, Profile } from '@/lib/types/database'
import { isAllowedEmail } from '@/lib/auth/allowed-domains'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components cannot set cookies — middleware handles refresh
          }
        },
      },
    }
  )
}

export async function getOrProvisionProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: Pick<User, 'id' | 'email' | 'user_metadata'>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingRaw } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (existingRaw) {
    return existingRaw as Profile
  }

  // Backfill a profile for users who land here before the auth callback provisions them
  // (e.g. deep-linked magic link on a new device).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcError } = await (supabase as any).rpc('upsert_profile_on_login', {
    user_id: user.id,
    user_email: user.email,
    user_full_name: user.user_metadata?.full_name ?? null,
    user_avatar_url: user.user_metadata?.avatar_url ?? null,
  })

  if (rpcError) {
    const isSchemaCacheMiss = rpcError.message?.includes('schema cache')
    if (!isSchemaCacheMiss) {
      console.error('[supabase/server] upsert_profile_on_login error:', rpcError.message)
    }
    // Fallback when PostgREST schema cache is cold — insert the profile row
    // directly so new users can still reach onboarding.
    if (!user.email || !await isAllowedEmail(user.email)) {
      console.error('[supabase/server] fallback blocked — email domain not allowed:', user.email)
      return null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
      })

    if (insertError) {
      console.error('[supabase/server] profile fallback insert error:', insertError.message)
      return null
    }

    // Also insert the self-closure row so the user appears in hierarchy queries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('org_closure').insert({
      ancestor_id: user.id,
      descendant_id: user.id,
      depth: 0,
    }).onConflict('ancestor_id,descendant_id').ignoreDuplicates()
  }

  // If there's a pending invite for this email, wire the manager_id now
  if (user.email) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: managerId } = await (supabase as any)
      .rpc('claim_pending_invite', { p_email: user.email })
    if (managerId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('profiles')
        .update({ manager_id: managerId })
        .eq('id', user.id)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: provisionedRaw } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  return (provisionedRaw as Profile | null) ?? null
}
