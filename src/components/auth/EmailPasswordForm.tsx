'use client'

import { useState, useTransition } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isAllowedEmail, DOMAIN_ERROR_MESSAGE } from '@/lib/auth/allowed-domains'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Mode = 'signin' | 'signup' | 'forgot'

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export default function EmailPasswordForm() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setSuccessMessage(null)
    setPassword('')
    setConfirmPassword('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (mode === 'forgot') {
      handleForgotPassword()
      return
    }

    if (!isAllowedEmail(email)) {
      setError(DOMAIN_ERROR_MESSAGE)
      return
    }

    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
    }

    startTransition(async () => {
      const supabase = createClient()

      if (mode === 'signin') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) {
          setError(authError.message)
        } else {
          window.location.href = '/dashboard'
        }
        return
      }

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (authError) {
        setError(authError.message)
      } else {
        setSuccessMessage(
          'Account created! Check your email for a confirmation link before signing in.'
        )
      }
    })
  }

  function handleForgotPassword() {
    if (!email) {
      setError('Enter your work email to receive a reset link.')
      return
    }
    if (!isAllowedEmail(email)) {
      setError(DOMAIN_ERROR_MESSAGE)
      return
    }
    startTransition(async () => {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      })
      if (authError) {
        setError(authError.message)
      } else {
        setSuccessMessage('Reset link sent — check your inbox.')
      }
    })
  }

  if (successMessage) {
    return (
      <div className="text-center space-y-4">
        <div
          className="h-12 w-12 rounded-full bg-lr-success-dim border border-lr-success/30 text-lr-success flex items-center justify-center mx-auto"
          aria-hidden="true"
        >
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-sm text-lr-muted">{successMessage}</p>
        <button
          type="button"
          onClick={() => {
            setSuccessMessage(null)
            switchMode('signin')
          }}
          className="text-xs text-lr-accent hover:text-lr-accent/80 transition-colors"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="ep-email" className="text-sm font-medium text-lr-text">
          Work email
        </Label>
        <Input
          id="ep-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          className="h-10 bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted focus-visible:ring-2 focus-visible:ring-lr-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lr-bg"
        />
      </div>

      {/* Password — hidden in forgot mode */}
      {mode !== 'forgot' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="ep-password" className="text-sm font-medium text-lr-text">
              Password
            </Label>
            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-xs text-lr-muted hover:text-lr-text transition-colors"
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <Input
              id="ep-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              className="h-10 bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted focus-visible:ring-2 focus-visible:ring-lr-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lr-bg pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-lr-muted hover:text-lr-text transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Confirm password — signup only */}
      {mode === 'signup' && (
        <div className="space-y-2">
          <Label htmlFor="ep-confirm" className="text-sm font-medium text-lr-text">
            Confirm password
          </Label>
          <Input
            id="ep-confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isPending}
            className="h-10 bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted focus-visible:ring-2 focus-visible:ring-lr-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lr-bg"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-[var(--radius-lr)] border border-lr-error/30 bg-lr-error-dim px-3 py-2 text-xs text-lr-error"
        >
          {error}
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="w-full bg-lr-accent hover:bg-lr-accent-hover text-white h-10 inline-flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <Spinner />
            {mode === 'signin' ? 'Signing in…' : mode === 'signup' ? 'Creating account…' : 'Sending…'}
          </>
        ) : mode === 'signin' ? (
          'Sign in'
        ) : mode === 'signup' ? (
          'Create account'
        ) : (
          'Send reset link'
        )}
      </Button>

      {/* Mode toggles */}
      <div className="text-center">
        {mode === 'signin' && (
          <p className="text-xs text-lr-muted">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className="text-lr-accent hover:text-lr-accent/80 transition-colors"
            >
              Sign up
            </button>
          </p>
        )}
        {mode === 'signup' && (
          <p className="text-xs text-lr-muted">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="text-lr-accent hover:text-lr-accent/80 transition-colors"
            >
              Sign in
            </button>
          </p>
        )}
        {mode === 'forgot' && (
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className="text-xs text-lr-muted hover:text-lr-text transition-colors"
          >
            Back to sign in
          </button>
        )}
      </div>
    </form>
  )
}
