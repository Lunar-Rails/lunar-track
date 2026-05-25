'use client'

import { useState, useTransition } from 'react'
import { submitOnboarding } from '@/lib/actions/onboarding-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Manager {
  id: string
  email: string
  full_name: string | null
}

export default function OnboardingForm({ managers }: { managers: Manager[] }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [managerId, setManagerId] = useState('')

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
          Your manager will see your request the next time they log in. Once they approve, you'll get access to the full dashboard.
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
        <input type="hidden" name="managerId" value={managerId} />
        <Select value={managerId} onValueChange={setManagerId} disabled={isPending} required>
          <SelectTrigger id="managerId" className="h-10 bg-lr-surface border-lr-border text-lr-text">
            <SelectValue placeholder="Select your manager…" />
          </SelectTrigger>
          <SelectContent className="bg-lr-surface border-lr-border">
            {managers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.full_name ?? m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-lr-muted">
          Your manager will see your request when they next log in and approve your access.
        </p>
      </div>

      {error && <p className="text-xs text-lr-error">{error}</p>}

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
