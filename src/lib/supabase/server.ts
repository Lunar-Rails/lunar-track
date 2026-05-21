import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database, Profile } from '@/lib/types/database'

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

  // Backfill a profile for password/manual-auth users who bypass the OAuth callback.
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
    // Fallback when PostgREST RPC schema cache is unavailable: create the
    // profile row directly so password-auth users can still reach onboarding.
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
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: provisionedRaw } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  return (provisionedRaw as Profile | null) ?? null
}
