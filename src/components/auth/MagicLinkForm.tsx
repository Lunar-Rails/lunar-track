'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { checkDomainAction } from '@/lib/auth/check-domain-action'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M4 12a8 8 0 0 1 8-8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function MagicLinkForm() {
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setError(null)
    startTransition(async () => {
      const { allowed, error: domainError } = await checkDomainAction(email)
      if (!allowed) {
        setError(domainError)
        return
      }
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (authError) {
        setError(authError.message)
      } else {
        window.location.href = `/login?sent=${encodeURIComponent(email)}`
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium text-lr-text">
          Work email
        </Label>
        <Input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          aria-invalid={!!error}
          aria-describedby={error ? 'email-error' : undefined}
          className="h-10 bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted focus-visible:ring-2 focus-visible:ring-lr-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lr-bg"
        />
        <p className="text-xs text-lr-muted">
          We&apos;ll email you a one-click sign-in link.
        </p>
      </div>

      {error && (
        <div
          id="email-error"
          role="alert"
          aria-live="polite"
          className="rounded-[var(--radius-lr)] border border-lr-error/30 bg-lr-error-dim px-3 py-2 text-xs text-lr-error"
        >
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending || !email || false}
        aria-busy={isPending}
        className="w-full bg-lr-accent hover:bg-lr-accent-hover text-white h-10 inline-flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <Spinner />
            Sending…
          </>
        ) : (
          'Send magic link'
        )}
      </Button>
    </form>
  )
}
