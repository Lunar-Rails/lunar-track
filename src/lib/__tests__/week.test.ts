import { describe, it, expect } from 'vitest'
import { mondayOf, monthRange } from '../week'

describe('mondayOf', () => {
  it('returns the same day for a Monday', () => {
    expect(mondayOf('2026-06-08')).toBe('2026-06-08') // Mon
  })
  it('returns the prior Monday for a mid-week day', () => {
    expect(mondayOf('2026-06-11')).toBe('2026-06-08') // Thu -> Mon
  })
  it('returns Monday for a Sunday', () => {
    expect(mondayOf('2026-06-14')).toBe('2026-06-08') // Sun -> prior Mon
  })
})

describe('monthRange', () => {
  it('returns [firstOfMonth, firstOfNextMonth) as ISO dates', () => {
    expect(monthRange(2026, 6)).toEqual({ start: '2026-06-01', endExclusive: '2026-07-01' })
  })
  it('rolls over the year in December', () => {
    expect(monthRange(2026, 12)).toEqual({ start: '2026-12-01', endExclusive: '2027-01-01' })
  })
})
