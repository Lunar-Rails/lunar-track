import { describe, it, expect } from 'vitest'
import {
  getMonthEnd,
  isReminderDay,
  getReminderType,
  getQuarterForMonth,
  getReminderPeriod,
  buildReminderMessage,
  getEffectiveDate,
} from '../reminder-logic'

// ---------------------------------------------------------------------------
// getMonthEnd
// ---------------------------------------------------------------------------
describe('getMonthEnd', () => {
  it('returns the last day of January (31)', () => {
    expect(getMonthEnd(2026, 1).getUTCDate()).toBe(31)
  })
  it('returns 28 for February in a non-leap year', () => {
    expect(getMonthEnd(2025, 2).getUTCDate()).toBe(28)
  })
  it('returns 29 for February in a leap year', () => {
    expect(getMonthEnd(2024, 2).getUTCDate()).toBe(29)
  })
  it('returns 30 for April, June, September, November', () => {
    for (const m of [4, 6, 9, 11]) {
      expect(getMonthEnd(2026, m).getUTCDate()).toBe(30)
    }
  })
  it('returns 31 for March, May, July, August, October, December', () => {
    for (const m of [3, 5, 7, 8, 10, 12]) {
      expect(getMonthEnd(2026, m).getUTCDate()).toBe(31)
    }
  })
})

// ---------------------------------------------------------------------------
// isReminderDay — "exactly 7 days before month-end"
// ---------------------------------------------------------------------------
describe('isReminderDay', () => {
  it('returns true on the 24th of a 31-day month (31-24=7)', () => {
    // January 24 → January 31 is 7 days out
    expect(isReminderDay(new Date('2026-01-24T09:00:00Z'))).toBe(true)
  })
  it('returns false on the 25th of a 31-day month (31-25=6)', () => {
    expect(isReminderDay(new Date('2026-01-25T09:00:00Z'))).toBe(false)
  })
  it('returns true on the 23rd of a 30-day month (30-23=7)', () => {
    // April has 30 days → April 23
    expect(isReminderDay(new Date('2026-04-23T09:00:00Z'))).toBe(true)
  })
  it('returns true on the 21st of February in a non-leap year (28-21=7)', () => {
    expect(isReminderDay(new Date('2025-02-21T09:00:00Z'))).toBe(true)
  })
  it('returns true on the 22nd of February in a leap year (29-22=7)', () => {
    expect(isReminderDay(new Date('2024-02-22T09:00:00Z'))).toBe(true)
  })
  it('returns false on the 21st of February in a leap year (29-21=8)', () => {
    expect(isReminderDay(new Date('2024-02-21T09:00:00Z'))).toBe(false)
  })
  it('returns true on March 24 (31-day month, 31-24=7)', () => {
    expect(isReminderDay(new Date('2026-03-24T09:00:00Z'))).toBe(true)
  })
  it('returns true on December 24 (31-day month)', () => {
    expect(isReminderDay(new Date('2026-12-24T09:00:00Z'))).toBe(true)
  })
  it('returns false on the first of any month', () => {
    for (const m of ['01', '04', '09', '12']) {
      expect(isReminderDay(new Date(`2026-${m}-01T09:00:00Z`))).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// getReminderType
// ---------------------------------------------------------------------------
describe('getReminderType', () => {
  it('returns quarterly for months 3, 6, 9, 12', () => {
    for (const m of [3, 6, 9, 12]) {
      expect(getReminderType(m)).toBe('quarterly')
    }
  })
  it('returns monthly for all other months', () => {
    for (const m of [1, 2, 4, 5, 7, 8, 10, 11]) {
      expect(getReminderType(m)).toBe('monthly')
    }
  })
})

// ---------------------------------------------------------------------------
// getQuarterForMonth
// ---------------------------------------------------------------------------
describe('getQuarterForMonth', () => {
  it('maps months 1-3 to Q1', () => {
    expect(getQuarterForMonth(1)).toBe(1)
    expect(getQuarterForMonth(2)).toBe(1)
    expect(getQuarterForMonth(3)).toBe(1)
  })
  it('maps months 4-6 to Q2', () => {
    expect(getQuarterForMonth(4)).toBe(2)
    expect(getQuarterForMonth(6)).toBe(2)
  })
  it('maps months 7-9 to Q3', () => {
    expect(getQuarterForMonth(7)).toBe(3)
    expect(getQuarterForMonth(9)).toBe(3)
  })
  it('maps months 10-12 to Q4', () => {
    expect(getQuarterForMonth(10)).toBe(4)
    expect(getQuarterForMonth(12)).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// getReminderPeriod
// ---------------------------------------------------------------------------
describe('getReminderPeriod', () => {
  it('returns correct period for March 2026', () => {
    const date = new Date('2026-03-24T09:00:00Z')
    const period = getReminderPeriod(date)
    expect(period.month).toBe(3)
    expect(period.quarter).toBe(1)
    expect(period.year).toBe(2026)
    expect(period.monthName).toBe('March')
    expect(period.monthEnd.getUTCDate()).toBe(31)
  })
  it('returns correct period for September 2026', () => {
    const date = new Date('2026-09-23T09:00:00Z')
    const period = getReminderPeriod(date)
    expect(period.month).toBe(9)
    expect(period.quarter).toBe(3)
    expect(period.year).toBe(2026)
    expect(period.monthName).toBe('September')
    expect(period.monthEnd.getUTCDate()).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// buildReminderMessage
// ---------------------------------------------------------------------------
describe('buildReminderMessage', () => {
  const APP_URL = 'https://ciaobob.app'

  it('monthly message has a header and action linking to /checkins', () => {
    const period = getReminderPeriod(new Date('2026-01-24T09:00:00Z'))
    const blocks = buildReminderMessage('monthly', period, APP_URL)

    const header = blocks.find(b => b.type === 'header')
    expect(header).toBeDefined()
    const headerText = (header!.text as { text: string }).text
    expect(headerText).toContain('January')

    const actions = blocks.find(b => b.type === 'actions')
    const btn = (actions!.elements as { url: string }[])[0]
    expect(btn.url).toBe(`${APP_URL}/checkins`)
  })

  it('quarterly message references the correct quarter and links to /quarterly-checkins', () => {
    const period = getReminderPeriod(new Date('2026-03-24T09:00:00Z'))
    const blocks = buildReminderMessage('quarterly', period, APP_URL)

    const header = blocks.find(b => b.type === 'header')
    const headerText = (header!.text as { text: string }).text
    expect(headerText).toContain('Q1')
    expect(headerText).toContain('2026')

    const actions = blocks.find(b => b.type === 'actions')
    const btn = (actions!.elements as { url: string }[])[0]
    expect(btn.url).toBe(`${APP_URL}/quarterly-checkins`)
  })

  it('section text includes deadline date', () => {
    const period = getReminderPeriod(new Date('2026-01-24T09:00:00Z'))
    const blocks = buildReminderMessage('monthly', period, APP_URL)
    const section = blocks.find(b => b.type === 'section')
    const text = (section!.text as { text: string }).text
    // January 31 should appear somewhere in the text
    expect(text).toContain('31')
  })
})

// ---------------------------------------------------------------------------
// getEffectiveDate
// ---------------------------------------------------------------------------
describe('getEffectiveDate', () => {
  it('returns today when no override is provided', () => {
    const before = Date.now()
    const d = getEffectiveDate()
    const after = Date.now()
    expect(d.getTime()).toBeGreaterThanOrEqual(before)
    expect(d.getTime()).toBeLessThanOrEqual(after)
  })

  it('parses a valid ISO override string', () => {
    const d = getEffectiveDate('2026-03-24T09:00:00Z')
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(2) // 0-based March
    expect(d.getUTCDate()).toBe(24)
  })

  it('falls back to today for an invalid override string', () => {
    const before = Date.now()
    const d = getEffectiveDate('not-a-date')
    const after = Date.now()
    expect(d.getTime()).toBeGreaterThanOrEqual(before)
    expect(d.getTime()).toBeLessThanOrEqual(after)
  })
})
