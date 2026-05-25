'use client'

import { useState, useTransition } from 'react'
import { updateNotificationPrefs } from '@/lib/actions/user-actions'
import type { UserRole } from '@/lib/types/database'

type Prefs = {
  checkin_reminders: boolean
  review_reminders: boolean
  goal_status_updates: boolean
  checkin_reviewed: boolean
  team_checkin_submitted: boolean
}

interface Props {
  initialPrefs: Prefs
  role: UserRole
}

export default function NotificationsSection({ initialPrefs, role }: Props) {
  const [prefs, setPrefs] = useState(initialPrefs)
  const [isPending, startTransition] = useTransition()
  const [savedKey, setSavedKey] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)

  function handleToggle(key: keyof Prefs) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSaveError(null)
    const fd = new FormData()
    Object.entries(next).forEach(([k, v]) => fd.append(k, String(v)))
    startTransition(async () => {
      const result = await updateNotificationPrefs(fd)
      if ('error' in result) {
        setSaveError(result.error)
        setPrefs(prefs)
      } else {
        setSavedKey((k) => k + 1)
      }
    })
  }

  const isManager = role === 'MANAGER' || role === 'HR_ADMIN'

  return (
    <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-lr-text">Notifications</h2>
        {isPending ? (
          <span className="text-xs text-lr-muted">Saving…</span>
        ) : saveError ? (
          <span className="text-xs text-lr-error">{saveError}</span>
        ) : savedKey > 0 ? (
          <span key={savedKey} className="text-xs text-lr-success animate-in fade-in duration-300">Saved</span>
        ) : null}
      </div>

      <div className="space-y-6">
        {/* Reminders — everyone */}
        <div>
          <p className="text-xs font-semibold text-lr-muted uppercase tracking-wider mb-3">Reminders</p>
          <div className="space-y-4">
            <ToggleRow
              label="Monthly check-in reminders"
              description="Reminded when your monthly check-in is due"
              checked={prefs.checkin_reminders}
              disabled={isPending}
              onToggle={() => handleToggle('checkin_reminders')}
            />
            <ToggleRow
              label="Quarterly review reminders"
              description="Reminded when quarterly reviews open"
              checked={prefs.review_reminders}
              disabled={isPending}
              onToggle={() => handleToggle('review_reminders')}
            />
          </div>
        </div>

        {/* Activity — everyone */}
        <div>
          <p className="text-xs font-semibold text-lr-muted uppercase tracking-wider mb-3">Activity</p>
          <div className="space-y-4">
            <ToggleRow
              label="Goal status updates"
              description="Email when your manager approves or requests a revision on a goal"
              checked={prefs.goal_status_updates}
              disabled={isPending}
              onToggle={() => handleToggle('goal_status_updates')}
            />
            <ToggleRow
              label="Check-in reviewed"
              description="Email when your manager completes their review notes on your check-in"
              checked={prefs.checkin_reviewed}
              disabled={isPending}
              onToggle={() => handleToggle('checkin_reviewed')}
            />
          </div>
        </div>

        {/* Manager-only */}
        {isManager && (
          <div>
            <p className="text-xs font-semibold text-lr-muted uppercase tracking-wider mb-3">My team</p>
            <div className="space-y-4">
              <ToggleRow
                label="Check-in submitted"
                description="Email when a direct report submits a monthly or quarterly check-in"
                checked={prefs.team_checkin_submitted}
                disabled={isPending}
                onToggle={() => handleToggle('team_checkin_submitted')}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onToggle,
}: {
  label: string
  description: string
  checked: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-lr-text">{label}</p>
        <p className="text-xs text-lr-muted mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lr-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lr-bg disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-lr-accent' : 'bg-lr-border'
        }`}
      >
        <span
          className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
