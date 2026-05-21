/**
 * CiaoBob Slack integration helpers.
 *
 * Usage: set SLACK_BOT_TOKEN in Netlify environment variables (Functions scope).
 * Without the token the helpers no-op in non-production environments.
 *
 * Required bot token scopes:
 *   - users:read.email   (look up users by email)
 *   - im:write           (open DM conversations)
 *   - chat:write         (post messages)
 */

import type { SlackBlock } from './reminder-logic'

const SLACK_API = 'https://slack.com/api'

function getBotToken(): string | undefined {
  return process.env.SLACK_BOT_TOKEN
}

async function slackPost<T extends { ok: boolean; error?: string }>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  const token = getBotToken()
  if (!token) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[slack] No SLACK_BOT_TOKEN — would call ${endpoint}`, body)
    }
    return null
  }

  try {
    const res = await fetch(`${SLACK_API}/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
    })
    const data = await res.json() as T
    if (!data.ok) {
      console.error(`[slack] ${endpoint} failed:`, data.error)
      return null
    }
    return data
  } catch (err) {
    console.error(`[slack] ${endpoint} threw:`, err)
    return null
  }
}

/**
 * Looks up a Slack user ID by their email address.
 * Returns the Slack user ID (e.g. "U012AB3CD") or null if not found.
 */
export async function lookupSlackUserByEmail(email: string): Promise<string | null> {
  const data = await slackPost<{ ok: boolean; error?: string; user?: { id: string } }>(
    'users.lookupByEmail',
    { email },
  )
  return data?.user?.id ?? null
}

/**
 * Opens a direct message channel with a Slack user.
 * Returns the channel ID or null on failure.
 */
async function openDMChannel(slackUserId: string): Promise<string | null> {
  const data = await slackPost<{ ok: boolean; error?: string; channel?: { id: string } }>(
    'conversations.open',
    { users: slackUserId },
  )
  return data?.channel?.id ?? null
}

/**
 * Sends a Block Kit DM to a Slack user.
 * Returns true if the message was sent successfully.
 */
export async function sendSlackDM(slackUserId: string, blocks: SlackBlock[]): Promise<boolean> {
  const channelId = await openDMChannel(slackUserId)
  if (!channelId) return false

  const data = await slackPost<{ ok: boolean; error?: string }>(
    'chat.postMessage',
    {
      channel: channelId,
      blocks,
      // Fallback text for notifications / accessibility
      text: blocks
        .filter(b => b.type === 'header')
        .map(b => (b.text as { text: string }).text)
        .join(' '),
    },
  )
  return data?.ok === true
}
