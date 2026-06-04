'use server'

import { isAllowedEmail, DOMAIN_ERROR_MESSAGE } from '@/lib/auth/allowed-domains'

export async function checkDomainAction(email: string): Promise<{ allowed: boolean; error: string | null }> {
  const allowed = await isAllowedEmail(email)
  return { allowed, error: allowed ? null : DOMAIN_ERROR_MESSAGE }
}
