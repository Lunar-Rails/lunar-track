'use client'

import { useTransition, useState } from 'react'
import { updateProfile } from '@/lib/actions/user-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Profile } from '@/lib/types/database'

interface Props {
  profile: Pick<Profile, 'full_name' | 'email' | 'role' | 'avatar_url'>
}

export default function ProfileSettingsForm({ profile }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateProfile(formData)
      if (result.error) setError(result.error)
      else setSuccess(true)
    })
  }

  const roleLabel =
    profile.role === 'HR_ADMIN' ? 'HR Admin' : profile.role === 'MANAGER' ? 'Manager' : 'Employee'

  return (
    <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full_name" className="text-sm font-medium text-lr-text">
            Display name
          </Label>
          <Input
            id="full_name"
            name="full_name"
            defaultValue={profile.full_name ?? ''}
            required
            maxLength={100}
            disabled={isPending}
            className="h-10 bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted focus-visible:ring-2 focus-visible:ring-lr-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lr-bg"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-lr-text">Email</Label>
          <p className="text-sm text-lr-muted">{profile.email}</p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-lr-text">Role</Label>
          <p className="text-sm text-lr-muted">{roleLabel}</p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-[var(--radius-lr)] border border-lr-error/30 bg-lr-error-dim px-3 py-2 text-xs text-lr-error"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            role="status"
            className="rounded-[var(--radius-lr)] border border-lr-success/30 bg-lr-success-dim px-3 py-2 text-xs text-lr-success"
          >
            Profile updated.
          </div>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="bg-lr-accent hover:bg-lr-accent-hover text-white h-10 px-5"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  )
}
