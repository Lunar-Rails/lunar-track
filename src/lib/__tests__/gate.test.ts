import { describe, it, expect } from 'vitest'
import { isGateExempt, GATE_EXEMPT_PREFIXES } from '../gate'

// ---------------------------------------------------------------------------
// First-check-in gate exemptions
//
// Regression coverage for the "Quarterly Reviews link is broken" bug: an
// onboarded user with no submitted check-in clicked "Quarterly Reviews" and was
// bounced back to /checkins because /quarterly-checkins was not gate-exempt.
// ---------------------------------------------------------------------------
describe('isGateExempt', () => {
  it('exempts /quarterly-checkins so the Quarterly Reviews link navigates', () => {
    expect(isGateExempt('/quarterly-checkins')).toBe(true)
  })

  it('exempts nested quarterly-checkins routes (new + detail)', () => {
    expect(isGateExempt('/quarterly-checkins/new')).toBe(true)
    expect(isGateExempt('/quarterly-checkins/abc-123')).toBe(true)
  })

  it('keeps Monthly Check-ins reachable', () => {
    expect(isGateExempt('/checkins')).toBe(true)
    expect(isGateExempt('/checkins/some-id')).toBe(true)
  })

  it('still gates routes that require a first check-in', () => {
    expect(isGateExempt('/dashboard')).toBe(false)
    expect(isGateExempt('/analytics')).toBe(false)
    expect(isGateExempt('/admin/settings')).toBe(false)
  })

  it('listing includes /quarterly-checkins explicitly', () => {
    expect(GATE_EXEMPT_PREFIXES).toContain('/quarterly-checkins')
  })
})
