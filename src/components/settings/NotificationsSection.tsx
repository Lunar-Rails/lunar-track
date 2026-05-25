'use client'

import { useState, useTransition } from 'react'
import { updateNotificationPrefs } from '@/lib/actions/user-actions'

interface Props {
  initialPrefs: { checkin_reminders: boolean; review_reminders: boolean }
}

export default function NotificationsSection({ initialPrefs }: Props) {
  const [prefs, setPrefs] = useState(initialPrefs)
  const [isPending, startTransition] = useTransition()
  const [savedKey, setSavedKey] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)

  function handleToggle(key: keyof typeof prefs) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSaveError(null)
    const fd = new FormData()
    fd.append('checkin_reminders', String(next.checkin_reminders))
    fd.append('review_reminders', String(next.review_reminders))
    startTransition(async () => {
      const result = await updateNotificationPrefs(fd)
      if ('error' in result) {
        setSaveError(result.error)
        setPrefs(prefs) // revert optimistic toggle
      } else {
        setSavedKey((k) => k + 1)
      }
    })
  }

  return (
    <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-lr-text">Notifications</h2>
        {isPending ? (
          <span className="text-xs text-lr-muted">Saving…</span>
        ) : saveError ? (
          <span className="text-xs text-lr-error">{saveError}</span>
        ) : savedKey > 0 ? (
          <span key={savedKey} className="text-xs text-lr-success animate-in fade-in duration-300">Saved</span>
        ) : null}
      </div>
      <div className="space-y-4">
        <ToggleRow
          label="Check-in reminders"
          description="Email reminders when monthly check-ins are due"
          checked={prefs.checkin_reminders}
          disabled={isPending}
          onToggle={() => handleToggle('checkin_reminders')}
        />
        <ToggleRow
          label="Quarterly review reminders"
          description="Email reminders when quarterly reviews open"
          checked={prefs.review_reminders}
          disabled={isPending}
          onToggle={() => handleToggle('review_reminders')}
        />
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
