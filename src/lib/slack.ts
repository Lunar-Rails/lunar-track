/**
 * CiaoBob Slack integration helpers.
 *
 * All public functions accept an explicit `token` so they work across multiple
 * Slack workspaces. The token is the bot's `xoxb-...` value for the workspace
 * that owns the target user's email domain.
 *
 * Required bot token scopes (per workspace):
 *   - users:read.email   (look up users by email)
 *   - im:write           (open DM conversations)
 *   - chat:write         (post messages)
 */

import type { SlackBlock } from './reminder-logic'

const SLACK_API = 'https://slack.com/api'

type ContentType = 'json' | 'form'

async function slackPost<T extends { ok: boolean; error?: string }>(
  endpoint: string,
  body: Record<string, unknown>,
  token: string,
  contentType: ContentType = 'json',
): Promise<T | null> {
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    }

    let encodedBody: string
    if (contentType === 'json') {
      headers['Content-Type'] = 'application/json; charset=utf-8'
      encodedBody = JSON.stringify(body)
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      encodedBody = new URLSearchParams(
        Object.entries(body).map(([k, v]) => [k, String(v)]),
      ).toString()
    }

    const res = await fetch(`${SLACK_API}/${endpoint}`, {
      method: 'POST',
      headers,
      body: encodedBody,
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
 * Looks up a Slack user ID by their email address within the workspace
 * identified by `token`.
 * Returns the Slack user ID (e.g. "U012AB3CD") or null if not found.
 */
export async function lookupSlackUserByEmail(
  email: string,
  token: string,
): Promise<string | null> {
  const data = await slackPost<{ ok: boolean; error?: string; user?: { id: string } }>(
    'users.lookupByEmail',
    { email },
    token,
    'form', // This method requires application/x-www-form-urlencoded
  )
  return data?.user?.id ?? null
}

/**
 * Opens a direct message channel with a Slack user.
 * Returns the channel ID or null on failure.
 */
async function openDMChannel(slackUserId: string, token: string): Promise<string | null> {
  const data = await slackPost<{ ok: boolean; error?: string; channel?: { id: string } }>(
    'conversations.open',
    { users: slackUserId },
    token,
  )
  return data?.channel?.id ?? null
}

/**
 * Sends a Block Kit DM to a Slack user in the workspace identified by `token`.
 * Returns true if the message was sent successfully.
 */
export async function sendSlackDM(
  slackUserId: string,
  blocks: SlackBlock[],
  token: string,
): Promise<boolean> {
  const channelId = await openDMChannel(slackUserId, token)
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
    token,
  )
  return data?.ok === true
}
