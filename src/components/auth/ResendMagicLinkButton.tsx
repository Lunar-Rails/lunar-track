'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

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

interface ResendMagicLinkButtonProps {
  email: string
}

export default function ResendMagicLinkButton({ email }: ResendMagicLinkButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  function handleResend() {
    if (isPending || cooldown > 0) return
    setError(null)
    startTransition(async () => {
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
        setCooldown(30)
      }
    })
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleResend}
        disabled={isPending || cooldown > 0}
        aria-busy={isPending}
        className="inline-flex items-center gap-2 border-lr-border text-lr-text hover:bg-lr-surface-2 hover:text-lr-text"
      >
        {isPending ? (
          <>
            <Spinner />
            Sending…
          </>
        ) : cooldown > 0 ? (
          `Resend in ${cooldown}s`
        ) : (
          'Resend link'
        )}
      </Button>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-[var(--radius-lr)] border border-lr-error/30 bg-lr-error-dim px-3 py-2 text-xs text-lr-error"
        >
          {error}
        </div>
      )}
    </div>
  )
}
