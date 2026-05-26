import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Config } from '@netlify/functions'
import {
  isReminderDay,
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
}

export default async function handler(request: Request): Promise<Response> {
  const reminderSecret = process.env.REMINDER_SECRET
  if (reminderSecret && request.headers.get('x-reminder-secret') !== reminderSecret) {
    return new Response('Forbidden', { status: 403 })
  }

  const today = getEffectiveDate(process.env.REMINDER_DATE_OVERRIDE)

  if (!isReminderDay(today)) {
    const msg = `[email-reminders] Not a reminder day (${today.toISOString().slice(0, 10)}), exiting.`
    console.log(msg)
    return new Response(msg, { status: 200 })
  }

  const period = getReminderPeriod(today)
  const type = getReminderType(period.month)

  console.log(
    `[email-reminders] Reminder day! type=${type} month=${period.month} quarter=${period.quarter} year=${period.year}`,
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
    .select('id, email, full_name')
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

  const submittedIds = await fetchSubmittedEmployeeIds(supabase, type, period)

  const pendingProfiles = (profiles as Profile[]).filter(p => !submittedIds.has(p.id))

  console.log(
    `[email-reminders] ${profiles.length} total employees, ${submittedIds.size} already submitted, ${pendingProfiles.length} need reminders`,
  )

  const deadlineStr = period.monthEnd.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const results = await Promise.allSettled(
    pendingProfiles.map(profile =>
      sendReminderEmail(profile, type, period, deadlineStr),
    ),
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  const summary = `[email-reminders] Done. sent=${sent} failed=${failed}`
  console.log(summary)
  return new Response(summary, { status: 200 })
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

async function sendReminderEmail(
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
}

export const config: Config = {
  schedule: '0 9 * * *', // Daily at 09:00 UTC — only fires on reminder days (7 days before month end)
}
