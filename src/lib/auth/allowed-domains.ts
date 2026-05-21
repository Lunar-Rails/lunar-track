// Domain whitelist for login. Update in sync with the SQL guard in
// supabase/migrations/00018_domain_whitelist.sql whenever domains change.
const ALLOWED_DOMAINS = [
  'lunarrails.io',
  '40acres.pro',
  'chainlabs.ai',
  'podproza.cz',
] as const

type AllowedDomain = (typeof ALLOWED_DOMAINS)[number]

export function isAllowedEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return !!domain && ALLOWED_DOMAINS.includes(domain as AllowedDomain)
}

export const DOMAIN_ERROR_MESSAGE =
  'Sign-in is restricted to authorized company domains.'
