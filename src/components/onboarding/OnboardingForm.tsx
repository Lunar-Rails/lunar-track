'use client'

import { useState, useTransition } from 'react'
import { submitOnboarding } from '@/lib/actions/onboarding-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Manager {
  id: string
  email: string
  full_name: string | null
}

export default function OnboardingForm({ managers }: { managers: Manager[] }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await submitOnboarding(formData)
      if ('error' in result) {
        setError(result.error)
      } else {
        setSubmitted(true)
      }
    })
  }

  if (submitted) {
    return (
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-cyan/20 bg-lr-cyan-dim px-6 py-8 text-center space-y-2">
        <p className="text-sm font-semibold text-lr-cyan">Request sent!</p>
        <p className="text-xs text-lr-muted">
          Your manager will be notified. Once they approve your request you'll get access to the full dashboard.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="fullName" className="text-caption">Your full name</Label>
        <Input
          id="fullName"
          name="fullName"
          placeholder="Jane Smith"
          required
          disabled={isPending}
          className="h-10 bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="managerId" className="text-caption">Your manager</Label>
        <select
          id="managerId"
          name="managerId"
          required
          disabled={isPending}
          defaultValue=""
          className="w-full h-10 rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface px-3 text-sm text-lr-text focus:outline-none focus:ring-2 focus:ring-lr-accent/50 disabled:opacity-50"
        >
          <option value="" disabled>Select your manager…</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name ?? m.email}
            </option>
          ))}
        </select>
        <p className="text-xs text-lr-muted">
          Your manager will receive a notification and approve your access.
        </p>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-lr-accent hover:bg-lr-accent/90 text-white h-10"
      >
        {isPending ? 'Sending request…' : 'Send request'}
      </Button>
    </form>
  )
}
