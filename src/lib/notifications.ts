/**
 * CiaoBob email notifications via Resend.
 *
 * Usage: Set RESEND_API_KEY in .env.local to enable.
 * Without the key the helper silently no-ops — safe in dev / CI.
 *
 * From address: set RESEND_FROM in .env.local (default: CiaoBob <noreply@lunartrack.internal>)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_ADDRESS = process.env.RESEND_FROM ?? 'CiaoBob <noreply@lunartrack.internal>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    // No-op in dev without API key — log intent so devs can see it
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[notifications] Would send "${subject}" to ${to}`)
    }
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[notifications] Resend error ${res.status}: ${body}`)
    }
  } catch (err) {
    console.error('[notifications] Failed to send email:', err)
  }
}

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0e0e14; color: #e1e1e8; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; padding: 32px; background: #1a1a2e; border-radius: 12px; border: 1px solid #2a2a40; }
    .logo { font-size: 18px; font-weight: 700; color: #7c5cfc; margin-bottom: 24px; }
    .content { font-size: 15px; line-height: 1.6; color: #c5c5d2; }
    .cta { display: inline-block; margin: 24px 0; padding: 12px 24px; background: #7c5cfc; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .footer { margin-top: 32px; font-size: 12px; color: #6b6b80; border-top: 1px solid #2a2a40; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🌙 CiaoBob</div>
    <div class="content">${content}</div>
    <div class="footer">CiaoBob — Internal Performance Management · <a href="${APP_URL}" style="color:#7c5cfc;">Open app</a></div>
  </div>
</body>
</html>
`
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
      <p><strong>${employeeName}</strong> has submitted their <strong>${month} ${year}</strong> check-in and it's ready for your review.</p>
      <a href="${url}" class="cta">Review check-in →</a>
      <p>You can also find it in your <a href="${APP_URL}/inbox" style="color:#7c5cfc;">Inbox</a>.</p>
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
      <p><strong>${managerName}</strong> has completed the post-meeting notes for your <strong>${month} ${year}</strong> check-in.</p>
      <a href="${url}" class="cta">View your check-in →</a>
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
      <blockquote style="border-left:3px solid #7c5cfc;margin:16px 0;padding:8px 16px;color:#e1e1e8;background:#12122a;border-radius:0 6px 6px 0;">
        ${esc(okrTitle)}
      </blockquote>
      <p><strong>New status:</strong> ${statusLabel[newStatus] ?? newStatus}</p>
      ${comment ? `<p><strong>Manager note:</strong> ${esc(comment)}</p>` : ''}
      <a href="${APP_URL}/goals" class="cta">View my goals →</a>
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
      <a href="${APP_URL}/login" class="cta">Sign in to CiaoBob →</a>
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
      <a href="${APP_URL}/login" class="cta">Join CiaoBob →</a>
      <p style="font-size:13px;color:#6b6b80;margin-top:16px;">If you weren't expecting this, you can safely ignore this email.</p>
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
      <a href="${APP_URL}/dashboard" class="cta">Go to dashboard →</a>
    `),
  )
}
