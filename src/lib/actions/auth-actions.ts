'use server'

import { createClient } from '@/lib/supabase/server'
import { isAllowedEmail, DOMAIN_ERROR_MESSAGE } from '@/lib/auth/allowed-domains'

type AuthResult = { success: true } | { error: string }

export async function serverSignUp(email: string, password: string): Promise<AuthResult> {
  if (!isAllowedEmail(email)) return { error: DOMAIN_ERROR_MESSAGE }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // callback URL is resolved server-side so the client cannot tamper with it
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function serverSignIn(email: string, password: string): Promise<AuthResult> {
  if (!isAllowedEmail(email)) return { error: DOMAIN_ERROR_MESSAGE }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }
  return { success: true }
}
