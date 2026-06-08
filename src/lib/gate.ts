// First-check-in gate: onboarded employees/managers who have not yet submitted
// their first monthly check-in are redirected to /checkins for every path that
// is NOT exempt below. Keep this list and `isGateExempt` in sync with the
// middleware that enforces the gate.

// Paths an onboarded-but-not-yet-checked-in employee may still reach.
export const GATE_EXEMPT_PREFIXES = [
  '/checkins',
  '/quarterly-checkins',
  '/guide',
  '/login',
  '/auth',
  '/onboarding',
  '/settings',
  '/org',
  '/team',
] as const

/**
 * Returns true when `pathname` is reachable without having submitted a first
 * monthly check-in (i.e. it is exempt from the first-check-in gate).
 *
 * Matching is by prefix, so nested routes such as `/quarterly-checkins/new`
 * and `/quarterly-checkins/:id` are exempt when their parent prefix is.
 */
export function isGateExempt(pathname: string): boolean {
  return GATE_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}
