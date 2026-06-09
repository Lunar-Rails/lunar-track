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

// Shared font stack — matches the app (Inter body) with broad email-client fallbacks.
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Helvetica, Arial, sans-serif"

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>CiaoBob</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f8; }
    .content { font-size: 15px; line-height: 1.65; color: #4a4a5e; }
    .content p { margin: 0 0 16px; }
    .content p:last-child { margin-bottom: 0; }
    .content strong { color: #1a1a28; font-weight: 600; }
    .content a { color: #7c5cfc; text-decoration: underline; }
    @media (max-width: 600px) {
      .px { padding-left: 22px !important; padding-right: 22px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f8;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#ffffff;border:1px solid #e7e7ef;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td class="px" style="padding:24px 32px;border-bottom:1px solid #eeeef4;">
              <img src="${APP_URL}/logo-email.png" width="150" height="44" alt="CiaoBob" style="display:block;width:150px;height:44px;">
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td class="px content" style="padding:32px;font-family:${FONT};font-size:15px;line-height:1.65;color:#4a4a5e;">${content}</td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="px" style="padding:18px 32px;border-top:1px solid #eeeef4;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:${FONT};font-size:12px;color:#9a9aae;">CiaoBob &mdash; Internal Performance Management</td>
                  <td align="right" style="font-family:${FONT};font-size:12px;"><a href="${APP_URL}" style="color:#7c5cfc;text-decoration:none;">Open app &rarr;</a></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function ctaButton(label: string, url: string): string {
  // Table + bgcolor button — renders as a solid filled button in all clients incl. Outlook.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
    <tr>
      <td align="center" bgcolor="#7c5cfc" style="border-radius:10px;background-color:#7c5cfc;">
        <a href="${url}" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.1px;">${label}</a>
      </td>
    </tr>
  </table>`
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
  const greeting = managerName ? `Hi ${esc(managerName.split(' ')[0])},` : 'Hi,'
  const url = `${APP_URL}/checkins/${checkinId}`

  await sendEmail(
    managerEmail,
    `${esc(employeeName)} submitted their ${month} check-in`,
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
  const greeting = employeeName ? `Hi ${esc(employeeName.split(' ')[0])},` : 'Hi,'
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
  const greeting = employeeName ? `Hi ${esc(employeeName.split(' ')[0])},` : 'Hi,'

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
  const greeting = managerName ? `Hi ${esc(managerName.split(' ')[0])},` : 'Hi,'
  const url = `${APP_URL}/checkins/${checkinId}`

  await sendEmail(
    managerEmail,
    `${esc(employeeName)} reopened their ${month} check-in`,
    baseTemplate(`
      <p>${greeting}</p>
      <p><strong>${esc(employeeName)}</strong> has reopened their <strong>${month} ${year}</strong> check-in to make some edits. You'll get another notification when they resubmit.</p>
      ${ctaButton('View check-in →', url)}
    `),
  )
}
