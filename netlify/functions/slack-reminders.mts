import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Config } from '@netlify/functions'
import {
  isInReminderWindow,
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
  notification_prefs?: {
    checkin_reminders?: boolean
    review_reminders?: boolean
  } | null
}

export default async function handler(request: Request): Promise<Response> {
  const reminderSecret = process.env.REMINDER_SECRET
  if (!reminderSecret) {
    console.error('[slack-reminders] REMINDER_SECRET not set — refusing to run')
    return new Response('Forbidden: REMINDER_SECRET not configured', { status: 403 })
  }
  if (request.headers.get('x-reminder-secret') !== reminderSecret) {
    return new Response('Forbidden', { status: 403 })
  }

  const today = getEffectiveDate(process.env.REMINDER_DATE_OVERRIDE)

  if (!isInReminderWindow(today)) {
    const msg = `[slack-reminders] Not in reminder window (${today.toISOString().slice(0, 10)}), exiting.`
    console.log(msg)
    return new Response(msg, { status: 200 })
  }

  const period = getReminderPeriod(today)
  const type = getReminderType(period.month)

  console.log(
    `[slack-reminders] In reminder window. type=${type} month=${period.month} quarter=${period.quarter} year=${period.year}`,
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

  // Fetch only EMPLOYEE profiles — managers and HR admins don't submit check-ins
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, full_name, notification_prefs')
    .eq('role', 'EMPLOYEE')

  if (profilesError) {
    console.error('[slack-reminders] Failed to fetch profiles:', profilesError.message)
    return new Response('Failed to fetch profiles', { status: 500 })
  }

  if (!profiles || profiles.length === 0) {
    console.log('[slack-reminders] No profiles found, nothing to do.')
    return new Response('No profiles', { status: 200 })
  }

  const [submittedIds, alreadyRemindedIds] = await Promise.all([
    fetchSubmittedEmployeeIds(supabase, type, period),
    fetchAlreadyRemindedIds(supabase, 'slack', type, period),
  ])

  const pendingProfiles = (profiles as Profile[]).filter(p =>
    !submittedIds.has(p.id) &&
    !alreadyRemindedIds.has(p.id) &&
    wantsReminder(p, type),
  )

  const optedOut = (profiles as Profile[]).filter(p => !wantsReminder(p, type)).length

  console.log(
    `[slack-reminders] ${profiles.length} total employees, ${submittedIds.size} already submitted, ${alreadyRemindedIds.size} already reminded, ${optedOut} opted out, ${pendingProfiles.length} to send`,
  )

  const results = await Promise.allSettled(
    pendingProfiles.map(profile =>
      sendReminderToEmployee(supabase, profile, type, period, appUrl, tokenMap),
    ),
  )

  const sent = results.filter(r => r.status === 'fulfilled' && r.value === 'sent').length
  const skipped = results.filter(r => r.status === 'fulfilled' && r.value === 'skipped').length
  const failed = results.filter(r => r.status === 'rejected').length

  const summary = `[slack-reminders] Done. sent=${sent} skipped=${skipped} failed=${failed}`
  console.log(summary)
  return new Response(summary, { status: 200 })
}

function wantsReminder(profile: Profile, type: ReminderType): boolean {
  const prefs = profile.notification_prefs
  if (type === 'quarterly') return prefs?.review_reminders !== false
  return prefs?.checkin_reminders !== false
}

async function fetchSubmittedEmployeeIds(
  supabase: SupabaseClient,
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

async function fetchAlreadyRemindedIds(
  supabase: SupabaseClient,
  channel: 'slack' | 'email',
  type: ReminderType,
  period: ReminderPeriod,
): Promise<Set<string>> {
  const { data: rows } = await supabase
    .from('reminder_log')
    .select('employee_id')
    .eq('channel', channel)
    .eq('reminder_type', type)
    .eq('month', period.month)
    .eq('year', period.year)

  return new Set((rows ?? []).map((r: { employee_id: string }) => r.employee_id))
}

async function logReminderSent(
  supabase: SupabaseClient,
  employeeId: string,
  channel: 'slack' | 'email',
  type: ReminderType,
  period: ReminderPeriod,
): Promise<void> {
  const { error } = await supabase.from('reminder_log').insert({
    employee_id: employeeId,
    channel,
    reminder_type: type,
    month: period.month,
    year: period.year,
  })
  if (error) {
    // Conflict = already logged (idempotent). Any other error is unexpected but non-fatal.
    if (!error.message.includes('unique') && !error.message.includes('duplicate')) {
      console.error(`[slack-reminders] Failed to log reminder for ${employeeId}:`, error.message)
    }
  }
}

async function sendReminderToEmployee(
  supabase: SupabaseClient,
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
    await logReminderSent(supabase, profile.id, 'slack', type, period)
    return 'sent'
  } else {
    console.error(`[slack-reminders] Failed to DM ${profile.email}`)
    return 'skipped'
  }
}

// Schedule is also declared in netlify.toml under [functions."slack-reminders"]
// as a fallback for Next.js plugin sites where inline config may not be picked up.
export const config: Config = {
  schedule: '0 9 * * *', // Daily at 09:00 UTC
}
