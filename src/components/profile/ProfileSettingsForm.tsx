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

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

const ROLE_LABELS: Record<string, string> = {
  HR_ADMIN: 'HR Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
}

export default function ProfileSettingsForm({ profile }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const initials = getInitials(profile.full_name, profile.email)
  const roleLabel = ROLE_LABELS[profile.role] ?? profile.role

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

  return (
    <div className="space-y-5">
      {/* Profile header */}
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-lr-accent text-white text-xl font-semibold">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-lr-text truncate">{profile.full_name ?? profile.email}</p>
          <p className="text-sm text-lr-muted truncate">{profile.email}</p>
          <span className="mt-1.5 inline-flex items-center rounded-full bg-lr-accent-dim px-2.5 py-0.5 text-xs font-medium text-lr-accent">
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Profile section — editable */}
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5">
        <h2 className="text-sm font-semibold text-lr-text mb-4">Profile</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
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

          {error && (
            <div role="alert" className="rounded-[var(--radius-lr)] border border-lr-error/30 bg-lr-error-dim px-3 py-2 text-xs text-lr-error">
              {error}
            </div>
          )}
          {success && (
            <div role="status" className="rounded-[var(--radius-lr)] border border-lr-success/30 bg-lr-success-dim px-3 py-2 text-xs text-lr-success">
              Profile updated.
            </div>
          )}

          <Button type="submit" disabled={isPending} className="bg-lr-accent hover:bg-lr-accent-hover text-white h-9 px-4 text-sm">
            {isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </div>

      {/* Account section — read-only */}
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5">
        <h2 className="text-sm font-semibold text-lr-text mb-4">Account</h2>
        <dl className="space-y-4">
          <div>
            <dt className="text-xs font-medium text-lr-muted uppercase tracking-wide mb-1">Email</dt>
            <dd className="text-sm text-lr-text">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-lr-muted uppercase tracking-wide mb-1">Role</dt>
            <dd className="text-sm text-lr-text">{roleLabel}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
