import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('profiles')
    .update({ pending_manager_id: null, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  return NextResponse.redirect(`${origin}/onboarding`)
}
