import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const supabase = await createClient()

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user?.email) {
    return NextResponse.redirect(`${origin}/login?error=no_user`)
  }

  // Provision profile — does NOT overwrite role on re-login
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcError } = await (supabase as any).rpc('upsert_profile_on_login', {
    user_id: user.id,
    user_email: user.email,
    user_full_name: user.user_metadata?.full_name ?? null,
    user_avatar_url: user.user_metadata?.avatar_url ?? null,
  })

  if (rpcError) {
    console.error('[auth/callback] upsert_profile_on_login error:', rpcError.message)
    // Non-fatal: user is authenticated
  }

  return NextResponse.redirect(`${origin}${next}`)
}
