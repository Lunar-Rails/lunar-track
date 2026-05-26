// Domain whitelist for login. To add a new company domain, add it here and push to main.
// This is the single source of truth — enforced in src/app/auth/callback/route.ts.
const ALLOWED_DOMAINS = [
  'lunarrails.io',
  'clovrlabs.com',
  '40acres.pro',
  'chainlabs.ai',
  'podproza.cz',
  'osirisconcepts.com',
] as const

type AllowedDomain = (typeof ALLOWED_DOMAINS)[number]

export function isAllowedEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return !!domain && ALLOWED_DOMAINS.includes(domain as AllowedDomain)
}

export const DOMAIN_ERROR_MESSAGE =
  'Sign-in is restricted to authorized company domains.'
