import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Config } from '@netlify/functions'
import {
  isInReminderWindow,
  getReminderType,
  getReminderPeriod,
  getEffectiveDate,
  type ReminderType,
  type ReminderPeriod,
} from '../../src/lib/reminder-logic'
import {
  notifyEmployeeMonthlyReminder,
  notifyEmployeeQuarterlyReminder,
} from '../../src/lib/notifications'

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
  if (reminderSecret && request.headers.get('x-reminder-secret') !== reminderSecret) {
    return new Response('Forbidden', { status: 403 })
  }

  const today = getEffectiveDate(process.env.REMINDER_DATE_OVERRIDE)

  if (!isInReminderWindow(today)) {
    const msg = `[email-reminders] Not in reminder window (${today.toISOString().slice(0, 10)}), exiting.`
    console.log(msg)
    return new Response(msg, { status: 200 })
  }

  const period = getReminderPeriod(today)
  const type = getReminderType(period.month)

  console.log(
    `[email-reminders] In reminder window. type=${type} month=${period.month} quarter=${period.quarter} year=${period.year}`,
  )

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    const err = '[email-reminders] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    console.error(err)
    return new Response(err, { status: 500 })
  }

  if (!process.env.MAILTRAP_API_TOKEN) {
    const err = '[email-reminders] Missing MAILTRAP_API_TOKEN — cannot send emails'
    console.error(err)
    return new Response(err, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, full_name, notification_prefs')
    .eq('role', 'EMPLOYEE')
    .eq('is_active', true)
    .eq('is_onboarded', true)

  if (profilesError) {
    console.error('[email-reminders] Failed to fetch profiles:', profilesError.message)
    return new Response('Failed to fetch profiles', { status: 500 })
  }

  if (!profiles || profiles.length === 0) {
    console.log('[email-reminders] No profiles found, nothing to do.')
    return new Response('No profiles', { status: 200 })
  }

  const [submittedIds, alreadyRemindedIds] = await Promise.all([
    fetchSubmittedEmployeeIds(supabase, type, period),
    fetchAlreadyRemindedIds(supabase, 'email', type, period),
  ])

  const pendingProfiles = (profiles as Profile[]).filter(p =>
    !submittedIds.has(p.id) &&
    !alreadyRemindedIds.has(p.id) &&
    wantsReminder(p, type),
  )

  const optedOut = (profiles as Profile[]).filter(p => !wantsReminder(p, type)).length

  console.log(
    `[email-reminders] ${profiles.length} total employees, ${submittedIds.size} already submitted, ${alreadyRemindedIds.size} already reminded, ${optedOut} opted out, ${pendingProfiles.length} to send`,
  )

  const deadlineStr = period.monthEnd.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const results = await Promise.allSettled(
    pendingProfiles.map(profile =>
      sendReminderEmail(supabase, profile, type, period, deadlineStr),
    ),
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  const summary = `[email-reminders] Done. sent=${sent} failed=${failed}`
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
      console.warn(`[email-reminders] No performance period for Q${period.quarter} ${period.year}`)
      return new Set()
    }

    const { data: rows } = await supabase
      .from('quarterly_checkins')
      .select('employee_id')
      .eq('period_id', pp.id)
      .not('employee_submitted_at', 'is', null)

    return new Set((rows ?? []).map((r: { employee_id: string }) => r.employee_id))
  }

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
    if (!error.message.includes('unique') && !error.message.includes('duplicate')) {
      console.error(`[email-reminders] Failed to log reminder for ${employeeId}:`, error.message)
    }
  }
}

async function sendReminderEmail(
  supabase: SupabaseClient,
  profile: Profile,
  type: ReminderType,
  period: ReminderPeriod,
  deadlineStr: string,
): Promise<void> {
  if (type === 'quarterly') {
    await notifyEmployeeQuarterlyReminder({
      employeeEmail: profile.email,
      employeeName: profile.full_name,
      quarter: period.quarter,
      year: period.year,
      deadlineStr,
    })
  } else {
    await notifyEmployeeMonthlyReminder({
      employeeEmail: profile.email,
      employeeName: profile.full_name,
      monthName: period.monthName,
      year: period.year,
      deadlineStr,
    })
  }
  console.log(`[email-reminders] Sent ${type} reminder to ${profile.email}`)
  await logReminderSent(supabase, profile.id, 'email', type, period)
}

// Schedule is also declared in netlify.toml under [functions."email-reminders"]
// as a fallback for Next.js plugin sites where inline config may not be picked up.
export const config: Config = {
  schedule: '0 9 * * *', // Daily at 09:00 UTC — only acts on days within reminder window
}
