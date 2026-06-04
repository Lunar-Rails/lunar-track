import { createClient } from '@/lib/supabase/server'

export async function isAllowedEmail(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false

  const supabase = await createClient()
  const { data } = await supabase
    .from('allowed_domains')
    .select('domain')
    .eq('domain', domain)
    .maybeSingle()

  return !!data
}

export const DOMAIN_ERROR_MESSAGE =
  'Sign-in is restricted to authorized company domains.'
