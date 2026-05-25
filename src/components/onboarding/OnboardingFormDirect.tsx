'use client'

import { useState, useTransition } from 'react'
import { submitOnboardingDirect } from '@/lib/actions/onboarding-actions'
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

interface OnboardingFormDirectProps {
  managers: Manager[]
  managerOptional?: boolean
}

export default function OnboardingFormDirect({ managers, managerOptional = false }: OnboardingFormDirectProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [managerId, setManagerId] = useState('')

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await submitOnboardingDirect(formData)
      if (result && 'error' in result) {
        setError(result.error)
      }
      // On success, submitOnboardingDirect redirects to /dashboard
    })
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
        <Label htmlFor="managerId" className="text-caption">
          Your manager{managerOptional && <span className="text-lr-muted ml-1">(optional)</span>}
        </Label>
        <input type="hidden" name="managerId" value={managerId} />
        <Select value={managerId} onValueChange={setManagerId} disabled={isPending}>
          <SelectTrigger id="managerId" className="h-10 bg-lr-surface border-lr-border text-lr-text">
            <SelectValue placeholder={managerOptional ? 'Select manager (optional)…' : 'Select your manager…'} />
          </SelectTrigger>
          <SelectContent className="bg-lr-surface border-lr-border">
            {managerOptional && (
              <SelectItem value="none">No manager — I report to no one</SelectItem>
            )}
            {managers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.full_name ?? m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-lr-muted">
          Your manager will see your check-ins and quarterly reviews.
        </p>
      </div>

      {error && <p className="text-xs text-lr-error">{error}</p>}

      <Button
        type="submit"
        disabled={isPending || (!managerOptional && !managerId)}
        className="w-full bg-lr-accent hover:bg-lr-accent/90 text-white h-10"
      >
        {isPending ? 'Setting up…' : 'Get started'}
      </Button>
    </form>
  )
}
