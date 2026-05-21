# Slack Reminders — Setup Guide

CiaoBob sends automated Slack DMs to employees who haven't submitted their check-in 1 week before month-end. This is handled by a Netlify Scheduled Function that runs daily at 09:00 UTC.

---

## 1. Create the CiaoBob Slack App

### Create the app

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Name it `CiaoBob`, select the BCOMM Slack workspace
4. Click **Create App**

### Add bot scopes

1. In the sidebar go to **OAuth & Permissions**
2. Scroll to **Scopes → Bot Token Scopes**
3. Add the following scopes:

| Scope | Purpose |
|-------|---------|
| `users:read.email` | Look up employees by their profile email |
| `im:write` | Open direct message conversations |
| `chat:write` | Send DM messages |

### Install to workspace

1. Scroll up on the **OAuth & Permissions** page
2. Click **Install to Workspace** → **Allow**
3. Copy the **Bot User OAuth Token** (starts with `xoxb-...`)

### Optional: Customize the bot appearance

- Under **Basic Information → Display Information**, set the name to `CiaoBob` and upload the app icon
- This is what employees will see as the sender of their reminder DMs

---

## 2. Configure Netlify Environment Variables

In the Netlify dashboard go to **Site configuration → Environment variables** and add the following. Set scope to **Functions** (or **All scopes** if you want them available at build time too).

| Variable | Value | Notes |
|----------|-------|-------|
| `SLACK_BOT_TOKEN` | `xoxb-...` | The bot token from step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | `<service role key>` | From Supabase Dashboard → Project Settings → API. May be auto-provisioned by the Netlify Supabase integration. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` | Already set if the app is deployed |
| `NEXT_PUBLIC_APP_URL` | `https://<your-domain>` | Already set for email notifications |
| `REMINDER_DATE_OVERRIDE` | (optional) | ISO date string, e.g. `2026-01-24T09:00:00Z`. Used for testing — overrides "today" so you can trigger a reminder outside the natural date. Remove after testing. |

> **Note:** The Netlify Supabase integration (Site configuration → Integrations → Supabase) may automatically inject `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL`. Check there first before adding them manually.

---

## 3. Deploy

The scheduled function is deployed automatically with the app. No extra steps are needed — Netlify picks up `netlify/functions/slack-reminders.mts` from the `netlify.toml` config.

To verify the function is recognized after deploy:
1. In the Netlify dashboard go to **Functions**
2. You should see `slack-reminders` listed with its cron schedule `0 9 * * *`

---

## 4. Test a Reminder Manually

To trigger a reminder without waiting for the cron:

### Via the Netlify CLI

```bash
# Install CLI if needed
npm install -g netlify-cli

# Link to your site
netlify link

# Set the date override so today looks like a reminder day
# (pick a date 7 days before the end of the current month)
export REMINDER_DATE_OVERRIDE="2026-01-24T09:00:00Z"

# Invoke the function
netlify functions:invoke slack-reminders
```

### Via the Netlify Dashboard

1. Go to **Functions → slack-reminders**
2. Click **Test function** (available in some plan tiers)

---

## 5. How It Works

The function runs every day at 09:00 UTC. On most days it exits within ~50ms after confirming the day is not a reminder day. On the reminder day (exactly 7 days before month-end) it:

1. Determines whether to send a **monthly check-in** or **quarterly review** reminder based on the current month
   - Months 3, 6, 9, 12 → quarterly review reminder
   - All other months → monthly check-in reminder

2. Fetches all employee profiles from Supabase

3. Batch-checks who has already submitted for the current period

4. For each employee who hasn't submitted:
   - Looks up their Slack user ID by email via `users.lookupByEmail`
   - Sends a Block Kit DM with a link to the relevant page in CiaoBob

Employees already outside the Slack workspace (e.g. email not found) are silently skipped. All activity is logged to Netlify Functions logs.

---

## 6. Reminder Schedule Reference

| Month | Day sent (approx.) | Reminder type |
|-------|--------------------|---------------|
| January | Jan 24 | Monthly check-in |
| February | Feb 21 (non-leap) / Feb 22 (leap) | Monthly check-in |
| March | Mar 24 | **Quarterly review (Q1)** |
| April | Apr 23 | Monthly check-in |
| May | May 24 | Monthly check-in |
| June | Jun 23 | **Quarterly review (Q2)** |
| July | Jul 24 | Monthly check-in |
| August | Aug 24 | Monthly check-in |
| September | Sep 23 | **Quarterly review (Q3)** |
| October | Oct 24 | Monthly check-in |
| November | Nov 23 | Monthly check-in |
| December | Dec 24 | **Quarterly review (Q4)** |
