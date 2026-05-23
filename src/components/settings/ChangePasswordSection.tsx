'use client'

import { useState, useTransition } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ChangePasswordSection() {
  const [isPending, startTransition] = useTransition()
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const fd = new FormData(e.currentTarget)
    const newPassword = fd.get('new_password') as string
    const confirm = fd.get('confirm_password') as string

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.')
      return
    }

    startTransition(async () => {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) setError(updateError.message)
      else {
        setSuccess(true)
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  return (
    <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5">
      <h2 className="text-sm font-semibold text-lr-text mb-1">Change password</h2>
      <p className="text-xs text-lr-muted mb-4">Leave blank to keep your current password.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new_password" className="text-sm font-medium text-lr-text">
            New password
          </Label>
          <div className="relative">
            <Input
              id="new_password"
              name="new_password"
              type={showNew ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              disabled={isPending}
              className="h-10 bg-lr-surface border-lr-border text-lr-text pr-10 placeholder:text-lr-muted focus-visible:ring-2 focus-visible:ring-lr-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lr-bg"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-lr-muted hover:text-lr-text transition-colors"
              aria-label={showNew ? 'Hide password' : 'Show password'}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm_password" className="text-sm font-medium text-lr-text">
            Confirm new password
          </Label>
          <div className="relative">
            <Input
              id="confirm_password"
              name="confirm_password"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repeat password"
              disabled={isPending}
              className="h-10 bg-lr-surface border-lr-border text-lr-text pr-10 placeholder:text-lr-muted focus-visible:ring-2 focus-visible:ring-lr-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lr-bg"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-lr-muted hover:text-lr-text transition-colors"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-[var(--radius-lr)] border border-lr-error/30 bg-lr-error-dim px-3 py-2 text-xs text-lr-error">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="rounded-[var(--radius-lr)] border border-lr-success/30 bg-lr-success-dim px-3 py-2 text-xs text-lr-success">
            Password updated.
          </div>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="bg-lr-accent hover:bg-lr-accent-hover text-white h-9 px-4 text-sm"
        >
          {isPending ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </div>
  )
}
