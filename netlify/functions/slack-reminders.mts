import { createClient } from '@supabase/supabase-js'
import type { Config } from '@netlify/functions'
import {
  isReminderDay,
  getReminderType,
  getReminderPeriod,
  getEffectiveDate,
  buildReminderMessage,
  parseWorkspaceTokens,
  getTokenForEmail,
  type ReminderType,
  type ReminderPeriod,
} from '../../src/lib/reminder-logic'
import { lookupSlackUserByEmail, sendSlackDM } from '../../src/lib/slack'

interface Profile {
  id: string
  email: string
  full_name: string | null
}

export default async function handler(): Promise<Response> {
  const today = getEffectiveDate(process.env.REMINDER_DATE_OVERRIDE)

  if (!isReminderDay(today)) {
    const msg = `[slack-reminders] Not a reminder day (${today.toISOString().slice(0, 10)}), exiting.`
    console.log(msg)
    return new Response(msg, { status: 200 })
  }

  const period = getReminderPeriod(today)
  const type = getReminderType(period.month)

  console.log(
    `[slack-reminders] Reminder day! type=${type} month=${period.month} quarter=${period.quarter} year=${period.year}`,
  )

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ciaobob.app'
  const workspaceTokensJson = process.env.SLACK_WORKSPACE_TOKENS ?? '{}'

  if (!supabaseUrl || !serviceRoleKey) {
    const err = '[slack-reminders] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    console.error(err)
    return new Response(err, { status: 500 })
  }

  const tokenMap = parseWorkspaceTokens(workspaceTokensJson)

  if (Object.keys(tokenMap).length === 0) {
    console.warn('[slack-reminders] SLACK_WORKSPACE_TOKENS is empty or unparseable — no reminders will be sent.')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Fetch all employee profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, full_name')

  if (profilesError) {
    console.error('[slack-reminders] Failed to fetch profiles:', profilesError.message)
    return new Response('Failed to fetch profiles', { status: 500 })
  }

  if (!profiles || profiles.length === 0) {
    console.log('[slack-reminders] No profiles found, nothing to do.')
    return new Response('No profiles', { status: 200 })
  }

  // Batch-fetch submitted employees for this period
  const submittedIds = await fetchSubmittedEmployeeIds(supabase, type, period)

  const pendingProfiles = (profiles as Profile[]).filter(
    p => !submittedIds.has(p.id),
  )

  console.log(
    `[slack-reminders] ${profiles.length} total employees, ${submittedIds.size} already submitted, ${pendingProfiles.length} need reminders`,
  )

  const results = await Promise.allSettled(
    pendingProfiles.map(profile =>
      sendReminderToEmployee(profile, type, period, appUrl, tokenMap),
    ),
  )

  const sent = results.filter(r => r.status === 'fulfilled' && r.value === 'sent').length
  const skipped = results.filter(r => r.status === 'fulfilled' && r.value === 'skipped').length
  const failed = results.filter(r => r.status === 'rejected').length

  const summary = `[slack-reminders] Done. sent=${sent} skipped=${skipped} failed=${failed}`
  console.log(summary)
  return new Response(summary, { status: 200 })
}

async function fetchSubmittedEmployeeIds(
  supabase: ReturnType<typeof createClient>,
  type: ReminderType,
  period: ReminderPeriod,
): Promise<Set<string>> {
  if (type === 'quarterly') {
    const { data: pp } = await supabase
      .from('performance_periods')
      .select('id')
      .eq('year', period.year)
      .eq('quarter', period.quarter)
      .single()

    if (!pp) {
      console.warn(
        `[slack-reminders] No performance period found for Q${period.quarter} ${period.year}`,
      )
      return new Set()
    }

    const { data: rows } = await supabase
      .from('quarterly_checkins')
      .select('employee_id')
      .eq('period_id', pp.id)
      .not('employee_submitted_at', 'is', null)

    return new Set((rows ?? []).map((r: { employee_id: string }) => r.employee_id))
  }

  // monthly
  const { data: rows } = await supabase
    .from('checkins')
    .select('employee_id')
    .eq('month', period.month)
    .eq('year', period.year)
    .not('employee_submitted_at', 'is', null)

  return new Set((rows ?? []).map((r: { employee_id: string }) => r.employee_id))
}

async function sendReminderToEmployee(
  profile: Profile,
  type: ReminderType,
  period: ReminderPeriod,
  appUrl: string,
  tokenMap: Record<string, string>,
): Promise<'sent' | 'skipped'> {
  const token = getTokenForEmail(profile.email, tokenMap)
  if (!token) {
    console.warn(
      `[slack-reminders] No Slack workspace token configured for domain of ${profile.email}, skipping.`,
    )
    return 'skipped'
  }

  const slackUserId = await lookupSlackUserByEmail(profile.email, token)
  if (!slackUserId) {
    console.log(
      `[slack-reminders] No Slack user found for ${profile.email}, skipping.`,
    )
    return 'skipped'
  }

  const blocks = buildReminderMessage(type, period, appUrl)
  const ok = await sendSlackDM(slackUserId, blocks, token)

  if (ok) {
    console.log(
      `[slack-reminders] Sent ${type} reminder to ${profile.email} (${profile.full_name ?? 'unknown'})`,
    )
    return 'sent'
  } else {
    console.error(`[slack-reminders] Failed to DM ${profile.email}`)
    return 'skipped'
  }
}

export const config: Config = {
  schedule: '0 9 * * *', // Daily at 09:00 UTC
}
