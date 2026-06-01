/**
 * CiaoBob email notifications via Mailtrap.
 *
 * Usage: Set MAILTRAP_API_TOKEN in .env.local to enable.
 * Without the key the helper silently no-ops — safe in dev / CI.
 *
 * From address: set MAILTRAP_FROM in .env.local (default: noreply@lunarrails.io)
 */

const MAILTRAP_API_TOKEN = process.env.MAILTRAP_API_TOKEN
const FROM_ADDRESS = process.env.MAILTRAP_FROM ?? 'noreply@lunarrails.io'
const FROM_NAME = 'CiaoBob'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!MAILTRAP_API_TOKEN) {
    // No-op in dev without API key — log intent so devs can see it
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[notifications] Would send "${subject}" to ${to}`)
    }
    return
  }

  try {
    const res = await fetch('https://send.api.mailtrap.io/api/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MAILTRAP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { email: FROM_ADDRESS, name: FROM_NAME },
        to: [{ email: to }],
        subject,
        html,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[notifications] Mailtrap error ${res.status}: ${body}`)
    }
  } catch (err) {
    console.error('[notifications] Failed to send email:', err)
  }
}

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CiaoBob</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif; background: #09090f; color: #e2e2ea; margin: 0; padding: 0; }
    .wrapper { padding: 40px 16px; }
    .container { max-width: 560px; margin: 0 auto; background: #12121e; border-radius: 16px; border: 1px solid #1e1e30; overflow: hidden; }
    .header { padding: 28px 32px 24px; border-bottom: 1px solid #1e1e30; }
    .logo { display: inline-flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 700; color: #fff; letter-spacing: -0.3px; text-decoration: none; }
    .logo-icon { width: 28px; height: 28px; background: linear-gradient(135deg, #7c5cfc 0%, #5b3fd4 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; line-height: 1; }
    .body { padding: 32px; }
    .content { font-size: 15px; line-height: 1.65; color: #b8b8c8; }
    .content p { margin-bottom: 16px; }
    .content p:last-child { margin-bottom: 0; }
    .content strong { color: #e2e2ea; font-weight: 600; }
    .content a { color: #7c5cfc; text-decoration: underline; }
    .cta-wrap { margin: 28px 0; }
    .cta { display: inline-block; padding: 13px 26px; background: #7c5cfc; color: #fff !important; text-decoration: none !important; border-radius: 10px; font-weight: 600; font-size: 14px; letter-spacing: 0.1px; }
    .footer { padding: 20px 32px; border-top: 1px solid #1e1e30; font-size: 12px; color: #4a4a60; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .footer a { color: #5a5a78; text-decoration: none; }
    .footer a:hover { color: #7c5cfc; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <span class="logo">
          <span class="logo-icon">🌙</span>
          CiaoBob
        </span>
      </div>
      <div class="body">
        <div class="content">${content}</div>
      </div>
      <div class="footer">
        <span>CiaoBob &mdash; Internal Performance Management</span>
        <a href="${APP_URL}">Open app &rarr;</a>
      </div>
    </div>
  </div>
</body>
</html>`
}

function ctaButton(label: string, url: string): string {
  return `<div class="cta-wrap"><a href="${url}" class="cta">${label}</a></div>`
}

// ────────────────────────────────────────────────────────────────────────────
// Notification events
// ────────────────────────────────────────────────────────────────────────────

/**
 * Employee submitted a check-in → notify their manager.
 */
export async function notifyManagerCheckinSubmitted(opts: {
  managerEmail: string
  managerName: string | null
  employeeName: string
  month: string
  year: number
  checkinId: string
}): Promise<void> {
  const { managerEmail, managerName, employeeName, month, year, checkinId } = opts
  const greeting = managerName ? `Hi ${managerName.split(' ')[0]},` : 'Hi,'
  const url = `${APP_URL}/checkins/${checkinId}`

  await sendEmail(
    managerEmail,
    `${employeeName} submitted their ${month} check-in`,
    baseTemplate(`
      <p>${greeting}</p>
      <p><strong>${esc(employeeName)}</strong> has submitted their <strong>${month} ${year}</strong> check-in and it's ready for your review.</p>
      ${ctaButton('Review check-in →', url)}
      <p>You can also find it in your <a href="${APP_URL}/inbox">Inbox</a>.</p>
    `),
  )
}

/**
 * Manager completed their post-meeting notes → notify the employee.
 */
export async function notifyEmployeeCheckinReviewed(opts: {
  employeeEmail: string
  employeeName: string | null
  managerName: string
  month: string
  year: number
  checkinId: string
}): Promise<void> {
  const { employeeEmail, employeeName, managerName, month, year, checkinId } = opts
  const greeting = employeeName ? `Hi ${employeeName.split(' ')[0]},` : 'Hi,'
  const url = `${APP_URL}/checkins/${checkinId}`

  await sendEmail(
    employeeEmail,
    `Your ${month} check-in has been reviewed`,
    baseTemplate(`
      <p>${greeting}</p>
      <p><strong>${esc(managerName)}</strong> has completed the post-meeting notes for your <strong>${month} ${year}</strong> check-in.</p>
      ${ctaButton('View your check-in →', url)}
    `),
  )
}

/**
 * Manager changed goal status → notify the employee.
 */
export async function notifyEmployeeOkrStatusChanged(opts: {
  employeeEmail: string
  employeeName: string | null
  okrTitle: string
  newStatus: string
  managerName: string
  comment?: string | null
}): Promise<void> {
  const { employeeEmail, employeeName, okrTitle, newStatus, managerName, comment } = opts
  const greeting = employeeName ? `Hi ${employeeName.split(' ')[0]},` : 'Hi,'

  const statusLabel: Record<string, string> = {
    APPROVED: '✅ Approved',
    REVISION_REQUESTED: '🔄 Revision requested',
  }

  const subject = `Goal ${statusLabel[newStatus] ?? newStatus}: "${esc(okrTitle)}"`

  await sendEmail(
    employeeEmail,
    subject,
    baseTemplate(`
      <p>${greeting}</p>
      <p><strong>${esc(managerName ?? '')}</strong> has updated the status of your goal:</p>
      <blockquote style="border-left:3px solid #7c5cfc;margin:16px 0;padding:10px 16px;color:#e2e2ea;background:#0e0e1a;border-radius:0 8px 8px 0;">
        ${esc(okrTitle)}
      </blockquote>
      <p><strong>New status:</strong> ${statusLabel[newStatus] ?? newStatus}</p>
      ${comment ? `<p><strong>Manager note:</strong> ${esc(comment)}</p>` : ''}
      ${ctaButton('View my goals →', `${APP_URL}/goals`)}
    `),
  )
}

/**
 * Employee invited a manager who isn't in the system yet → notify the manager.
 */
export async function notifyManagerInvite(opts: {
  managerEmail: string
  employeeName: string
}): Promise<void> {
  const { managerEmail, employeeName } = opts

  await sendEmail(
    managerEmail,
    `${esc(employeeName)} has listed you as their manager on CiaoBob`,
    baseTemplate(`
      <p>Hi,</p>
      <p><strong>${esc(employeeName)}</strong> has listed you as their manager on CiaoBob and is waiting for your approval.</p>
      <p>Sign in to CiaoBob to complete your own profile setup and approve their request.</p>
      ${ctaButton('Sign in to CiaoBob →', `${APP_URL}/login`)}
    `),
  )
}

/**
 * Manager invited a new team member → notify the invitee.
 */
export async function notifyTeamMemberInvited(opts: {
  inviteeEmail: string
  managerName: string
}): Promise<void> {
  const { inviteeEmail, managerName } = opts

  await sendEmail(
    inviteeEmail,
    `${esc(managerName)} has invited you to CiaoBob`,
    baseTemplate(`
      <p>Hi,</p>
      <p><strong>${esc(managerName)}</strong> has added you to their team on <strong>CiaoBob</strong>, the performance management platform used across the group.</p>
      <p>Sign in with your work Google account to set up your profile and get started.</p>
      ${ctaButton('Join CiaoBob →', `${APP_URL}/login`)}
      <p style="font-size:13px;color:#4a4a60;">If you weren't expecting this, you can safely ignore this email.</p>
    `),
  )
}

/**
 * Reminder: employee hasn't submitted their monthly check-in yet.
 */
export async function notifyEmployeeMonthlyReminder(opts: {
  employeeEmail: string
  employeeName: string | null
  monthName: string
  year: number
  deadlineStr: string
}): Promise<void> {
  const { employeeEmail, employeeName, monthName, year, deadlineStr } = opts
  const greeting = employeeName ? `Hi ${esc(employeeName.split(' ')[0])},` : 'Hi,'

  await sendEmail(
    employeeEmail,
    `Reminder: your ${monthName} check-in is due ${deadlineStr}`,
    baseTemplate(`
      <p>${greeting}</p>
      <p>Just a reminder that your <strong>${monthName} ${year} monthly check-in</strong> hasn't been submitted yet.</p>
      <p>It's due by <strong>${deadlineStr}</strong> — it only takes a few minutes to share your MITs and reflections.</p>
      ${ctaButton('Complete check-in →', `${APP_URL}/checkins`)}
    `),
  )
}

/**
 * Reminder: employee hasn't submitted their quarterly review yet.
 */
export async function notifyEmployeeQuarterlyReminder(opts: {
  employeeEmail: string
  employeeName: string | null
  quarter: number
  year: number
  deadlineStr: string
}): Promise<void> {
  const { employeeEmail, employeeName, quarter, year, deadlineStr } = opts
  const greeting = employeeName ? `Hi ${esc(employeeName.split(' ')[0])},` : 'Hi,'

  await sendEmail(
    employeeEmail,
    `Reminder: your Q${quarter} ${year} review is due ${deadlineStr}`,
    baseTemplate(`
      <p>${greeting}</p>
      <p>Your <strong>Q${quarter} ${year} quarterly review</strong> hasn't been submitted yet.</p>
      <p>It's due by <strong>${deadlineStr}</strong> — take a few minutes to reflect on your goals, values, and plans for next quarter.</p>
      ${ctaButton('Complete quarterly review →', `${APP_URL}/quarterly-checkins`)}
    `),
  )
}

/**
 * HR approved a team join request → notify the new employee.
 */
export async function notifyEmployeeOnboardingApproved(opts: {
  employeeEmail: string
  employeeName: string | null
  managerName: string
}): Promise<void> {
  const { employeeEmail, employeeName, managerName } = opts
  const greeting = employeeName ? `Hi ${esc(employeeName.split(' ')[0])},` : 'Hi,'

  await sendEmail(
    employeeEmail,
    'You\'ve been added to a team on CiaoBob',
    baseTemplate(`
      <p>${greeting}</p>
      <p>You've been approved and assigned to <strong>${esc(managerName)}</strong>'s team on CiaoBob.</p>
      <p>You can now access check-ins, goals, and your performance results.</p>
      ${ctaButton('Go to dashboard →', `${APP_URL}/dashboard`)}
    `),
  )
}

/**
 * Employee reopened a submitted check-in → notify their manager.
 */
export async function notifyManagerCheckinReopened(opts: {
  managerEmail: string
  managerName: string | null
  employeeName: string
  month: string
  year: number
  checkinId: string
}): Promise<void> {
  const { managerEmail, managerName, employeeName, month, year, checkinId } = opts
  const greeting = managerName ? `Hi ${managerName.split(' ')[0]},` : 'Hi,'
  const url = `${APP_URL}/checkins/${checkinId}`

  await sendEmail(
    managerEmail,
    `${employeeName} reopened their ${month} check-in`,
    baseTemplate(`
      <p>${greeting}</p>
      <p><strong>${esc(employeeName)}</strong> has reopened their <strong>${month} ${year}</strong> check-in to make some edits. You'll get another notification when they resubmit.</p>
      ${ctaButton('View check-in →', url)}
    `),
  )
}
