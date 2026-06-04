/**
 * Pure functions for check-in reminder logic.
 * No I/O — kept dependency-free for easy unit testing.
 */

export type ReminderType = 'monthly' | 'quarterly'

export interface ReminderPeriod {
  month: number
  quarter: number
  year: number
  monthName: string
  monthEnd: Date
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Returns the last day of the given month/year in UTC.
 */
export function getMonthEnd(year: number, month: number): Date {
  // Day 0 of next month = last day of current month
  return new Date(Date.UTC(year, month, 0))
}

/**
 * Returns true if the given date falls within the reminder window — i.e. between
 * 1 and `windowDays` days before month end (inclusive), UTC.
 *
 * Running on a window rather than a single day lets missed or failed sends be
 * automatically retried on subsequent cron runs. The `reminder_log` table prevents
 * duplicate messages: an employee is only messaged once per period per channel
 * regardless of how many days the function runs within the window.
 */
export function isInReminderWindow(date: Date, windowDays = 7): boolean {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1 // 1-based
  const dayOfMonth = date.getUTCDate()

  const monthEnd = getMonthEnd(year, month)
  const lastDay = monthEnd.getUTCDate()

  const daysRemaining = lastDay - dayOfMonth
  return daysRemaining >= 1 && daysRemaining <= windowDays
}

/**
 * @deprecated Use `isInReminderWindow` instead.
 * Kept for backwards compatibility — delegates to the new window check.
 */
export function isReminderDay(date: Date, daysBeforeEnd = 7): boolean {
  return isInReminderWindow(date, daysBeforeEnd)
}

/**
 * Returns whether the given month is the last month of a quarter.
 * Months 3 (March), 6 (June), 9 (September), 12 (December) are quarter-end months.
 */
export function getReminderType(month: number): ReminderType {
  return month % 3 === 0 ? 'quarterly' : 'monthly'
}

/**
 * Returns the quarter number (1–4) for a given month (1–12).
 */
export function getQuarterForMonth(month: number): number {
  return Math.ceil(month / 3)
}

/**
 * Builds a full ReminderPeriod context from a given date.
 */
export function getReminderPeriod(date: Date): ReminderPeriod {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  return {
    month,
    quarter: getQuarterForMonth(month),
    year,
    monthName: MONTH_NAMES[month - 1],
    monthEnd: getMonthEnd(year, month),
  }
}

export interface SlackBlock {
  type: string
  [key: string]: unknown
}

/**
 * Builds the Slack Block Kit message payload for a check-in reminder.
 */
export function buildReminderMessage(
  type: ReminderType,
  period: ReminderPeriod,
  appUrl: string,
): SlackBlock[] {
  const { month, quarter, year, monthName, monthEnd } = period

  const deadlineStr = monthEnd.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  if (type === 'quarterly') {
    const url = `${appUrl}/quarterly-checkins`
    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `:calendar: Your Q${quarter} ${year} review is due soon`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Your *Q${quarter} ${year} quarterly review* is due by *${deadlineStr}* and hasn't been submitted yet.\n\nTake a few minutes to reflect on your goals, values, and plans for next quarter.`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Complete quarterly review →', emoji: true },
            style: 'primary',
            url,
          },
        ],
      },
    ]
  }

  // monthly
  const url = `${appUrl}/checkins`
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:memo: Your ${monthName} check-in is due soon`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Your *${monthName} ${year} monthly check-in* is due by *${deadlineStr}* and hasn't been submitted yet.\n\nShare your MITs, reflections, and plans for next month.`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Complete check-in →', emoji: true },
          style: 'primary',
          url,
        },
      ],
    },
  ]
}

/**
 * Parses an ISO date string override from env (REMINDER_DATE_OVERRIDE) or returns today in UTC.
 */
export function getEffectiveDate(override?: string): Date {
  if (override) {
    const d = new Date(override)
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

// ---------------------------------------------------------------------------
// Multi-workspace Slack token helpers
// ---------------------------------------------------------------------------

/**
 * Parses the SLACK_WORKSPACE_TOKENS env var.
 *
 * Expected format (JSON object keyed by email domain):
 *   {"lunarrails.io":"xoxb-aaa","chainlabs.ai":"xoxb-bbb","podproza.cz":"xoxb-ccc"}
 *
 * Returns an empty object on parse failure so the function degrades gracefully.
 */
export function parseWorkspaceTokens(json: string): Record<string, string> {
  try {
    const parsed = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    // Keep only string-valued entries
    return Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => typeof v === 'string'),
    ) as Record<string, string>
  } catch {
    return {}
  }
}

/**
 * Returns the Slack bot token for the workspace that owns the given email address,
 * or null if the domain is not configured.
 *
 * @param email    Full email address, e.g. "alice@lunarrails.io"
 * @param tokenMap Domain → token map produced by parseWorkspaceTokens()
 */
export function getTokenForEmail(
  email: string,
  tokenMap: Record<string, string>,
): string | null {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null
  return tokenMap[domain] ?? null
}
