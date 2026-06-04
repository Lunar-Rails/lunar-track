import { describe, it, expect } from 'vitest'
import {
  getMonthEnd,
  isInReminderWindow,
  isReminderDay,
  getReminderType,
  getQuarterForMonth,
  getReminderPeriod,
  buildReminderMessage,
  getEffectiveDate,
  parseWorkspaceTokens,
  getTokenForEmail,
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
// isInReminderWindow — "between 1 and 7 days before month-end, inclusive"
// ---------------------------------------------------------------------------
describe('isInReminderWindow', () => {
  // Start of window (day -7)
  it('returns true on the 24th of a 31-day month (31-24=7, window start)', () => {
    expect(isInReminderWindow(new Date('2026-01-24T09:00:00Z'))).toBe(true)
  })

  // Day -6 — was false with the old single-day check, now true
  it('returns true on the 25th of a 31-day month (31-25=6, inside window)', () => {
    expect(isInReminderWindow(new Date('2026-01-25T09:00:00Z'))).toBe(true)
  })

  // End of window (day -1)
  it('returns true on the 30th of a 31-day month (31-30=1, window end)', () => {
    expect(isInReminderWindow(new Date('2026-01-30T09:00:00Z'))).toBe(true)
  })

  // Last day of month — not in window (0 days remaining)
  it('returns false on the last day of the month (0 days remaining)', () => {
    expect(isInReminderWindow(new Date('2026-01-31T09:00:00Z'))).toBe(false)
  })

  // Before window
  it('returns false on the 23rd of a 31-day month (31-23=8, before window)', () => {
    expect(isInReminderWindow(new Date('2026-01-23T09:00:00Z'))).toBe(false)
  })

  it('returns true on the 23rd of a 30-day month (30-23=7, window start)', () => {
    // April has 30 days
    expect(isInReminderWindow(new Date('2026-04-23T09:00:00Z'))).toBe(true)
  })

  it('returns true on the 29th of a 30-day month (30-29=1, window end)', () => {
    expect(isInReminderWindow(new Date('2026-04-29T09:00:00Z'))).toBe(true)
  })

  it('returns false on April 30 (last day, 0 remaining)', () => {
    expect(isInReminderWindow(new Date('2026-04-30T09:00:00Z'))).toBe(false)
  })

  it('returns true for all 7 days of the window in a 28-day February', () => {
    // Feb 2025: last day = 28, window = days 21–27
    for (let d = 21; d <= 27; d++) {
      const pad = String(d).padStart(2, '0')
      expect(isInReminderWindow(new Date(`2025-02-${pad}T09:00:00Z`))).toBe(true)
    }
  })

  it('returns false on Feb 28 (last day of non-leap year)', () => {
    expect(isInReminderWindow(new Date('2025-02-28T09:00:00Z'))).toBe(false)
  })

  it('returns true for all 7 days of the window in a 29-day February (leap year)', () => {
    // Feb 2024: last day = 29, window = days 22–28
    for (let d = 22; d <= 28; d++) {
      const pad = String(d).padStart(2, '0')
      expect(isInReminderWindow(new Date(`2024-02-${pad}T09:00:00Z`))).toBe(true)
    }
  })

  it('returns false on the first of any month (far outside window)', () => {
    for (const m of ['01', '04', '09', '12']) {
      expect(isInReminderWindow(new Date(`2026-${m}-01T09:00:00Z`))).toBe(false)
    }
  })

  it('respects a custom windowDays parameter', () => {
    // 3-day window for a 31-day month: days 28, 29, 30 are in; 27 is out; 31 is out
    expect(isInReminderWindow(new Date('2026-01-30T09:00:00Z'), 3)).toBe(true)
    expect(isInReminderWindow(new Date('2026-01-28T09:00:00Z'), 3)).toBe(true)
    expect(isInReminderWindow(new Date('2026-01-27T09:00:00Z'), 3)).toBe(false)
    expect(isInReminderWindow(new Date('2026-01-31T09:00:00Z'), 3)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isReminderDay — deprecated alias, delegates to isInReminderWindow
// ---------------------------------------------------------------------------
describe('isReminderDay (deprecated alias)', () => {
  it('still returns true on the classic day-7 date', () => {
    expect(isReminderDay(new Date('2026-01-24T09:00:00Z'))).toBe(true)
  })
  it('now also returns true inside the window (day -6)', () => {
    expect(isReminderDay(new Date('2026-01-25T09:00:00Z'))).toBe(true)
  })
  it('returns false outside the window', () => {
    expect(isReminderDay(new Date('2026-01-01T09:00:00Z'))).toBe(false)
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
// parseWorkspaceTokens
// ---------------------------------------------------------------------------
describe('parseWorkspaceTokens', () => {
  it('parses a valid JSON token map', () => {
    const json = JSON.stringify({
      'lunarrails.io': 'xoxb-aaa',
      'chainlabs.ai': 'xoxb-bbb',
      'podproza.cz': 'xoxb-ccc',
    })
    const result = parseWorkspaceTokens(json)
    expect(result['lunarrails.io']).toBe('xoxb-aaa')
    expect(result['chainlabs.ai']).toBe('xoxb-bbb')
    expect(result['podproza.cz']).toBe('xoxb-ccc')
  })

  it('returns empty object for invalid JSON', () => {
    expect(parseWorkspaceTokens('not-json')).toEqual({})
  })

  it('returns empty object for an empty string', () => {
    expect(parseWorkspaceTokens('')).toEqual({})
  })

  it('returns empty object for JSON array (wrong shape)', () => {
    expect(parseWorkspaceTokens('["xoxb-aaa"]')).toEqual({})
  })

  it('strips non-string values', () => {
    const json = JSON.stringify({ 'lunarrails.io': 'xoxb-aaa', 'bad.domain': 42 })
    const result = parseWorkspaceTokens(json)
    expect(result['lunarrails.io']).toBe('xoxb-aaa')
    expect(result['bad.domain']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// getTokenForEmail
// ---------------------------------------------------------------------------
describe('getTokenForEmail', () => {
  const tokenMap = {
    'lunarrails.io': 'xoxb-aaa',
    'chainlabs.ai': 'xoxb-bbb',
    'podproza.cz': 'xoxb-ccc',
  }

  it('returns the correct token for a known domain', () => {
    expect(getTokenForEmail('alice@lunarrails.io', tokenMap)).toBe('xoxb-aaa')
    expect(getTokenForEmail('bob@chainlabs.ai', tokenMap)).toBe('xoxb-bbb')
    expect(getTokenForEmail('carol@podproza.cz', tokenMap)).toBe('xoxb-ccc')
  })

  it('is case-insensitive for the domain part', () => {
    expect(getTokenForEmail('alice@LunarRails.IO', tokenMap)).toBe('xoxb-aaa')
    expect(getTokenForEmail('bob@CHAINLABS.AI', tokenMap)).toBe('xoxb-bbb')
  })

  it('returns null for an unknown domain', () => {
    expect(getTokenForEmail('dave@unknown.com', tokenMap)).toBeNull()
  })

  it('returns null for an email with no @ sign', () => {
    expect(getTokenForEmail('not-an-email', tokenMap)).toBeNull()
  })

  it('returns null when the token map is empty', () => {
    expect(getTokenForEmail('alice@lunarrails.io', {})).toBeNull()
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
