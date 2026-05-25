import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/types/database'

// Paths an onboarded-but-not-yet-checked-in employee may still reach
const GATE_EXEMPT_PREFIXES = [
  '/checkins',
  '/guide',
  '/login',
  '/auth',
  '/onboarding',
  '/settings',
  '/dashboard',
  '/org',
]

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Never use getSession() — always getUser() which validates JWT
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Redirect unauthenticated users to login
  if (
    !user &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // First-check-in gate: onboarded employees must submit their first monthly
  // check-in before accessing the rest of the app.
  if (user && !GATE_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profileRow } = await (supabase as any)
      .from('profiles')
      .select('role, is_onboarded')
      .eq('id', user.id)
      .single()

    if ((profileRow?.role === 'EMPLOYEE' || profileRow?.role === 'MANAGER') && profileRow.is_onboarded) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (supabase as any)
        .from('checkins')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', user.id)
        .not('employee_submitted_at', 'is', null)

      if (!count) {
        const url = request.nextUrl.clone()
        url.pathname = '/checkins'
        url.search = ''
        const redirectResponse = NextResponse.redirect(url)
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie)
        })
        return redirectResponse
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
