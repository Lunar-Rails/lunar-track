import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAllowedEmail } from '@/lib/auth/allowed-domains'

function safeRedirectPath(raw: string | null): string {
  const fallback = '/dashboard'
  if (!raw) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) return fallback
  return raw
}

// Netlify's Next.js plugin exposes the internal deploy host (main--<site>.netlify.app)
// via `request.url`, so URL(request.url).origin points at the wrong host. Pin redirects
// to the canonical public origin so auth cookies always attach to the same domain
// the user reached the app on, never a branch/preview deploy URL.
function getPublicOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/$/, '')
  return new URL(request.url).origin
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = getPublicOrigin(request)
  const code = searchParams.get('code')
  const next = safeRedirectPath(searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const supabase = await createClient()

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    // If exchange fails but the user already has a valid pre-existing session, send them on
    // rather than dropping them on the error page (e.g. stale magic link on an active session)
    const {
      data: { user: existingUser },
    } = await supabase.auth.getUser()
    if (existingUser) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user?.email) {
    return NextResponse.redirect(`${origin}/login?error=no_user`)
  }

  if (!await isAllowedEmail(user.email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=domain`)
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
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=provision`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
