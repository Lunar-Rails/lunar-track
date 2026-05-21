'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Mode = 'magic' | 'password'

export default function MagicLinkForm() {
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    if (mode === 'password' && !password) return
    setError(null)
    startTransition(async () => {
      const supabase = createClient()
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) {
          setError(error.message)
        } else {
          window.location.href = `/login?sent=${encodeURIComponent(email)}`
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) {
          setError(error.message)
        } else {
          window.location.href = '/dashboard'
        }
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex gap-1 p-1 rounded-[var(--radius-lr)] bg-lr-surface border border-lr-border">
        <button
          type="button"
          onClick={() => setMode('password')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-[var(--radius-lr-sm)] transition-colors ${
            mode === 'password'
              ? 'bg-lr-accent text-white'
              : 'text-lr-muted hover:text-lr-text'
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode('magic')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-[var(--radius-lr-sm)] transition-colors ${
            mode === 'magic'
              ? 'bg-lr-accent text-white'
              : 'text-lr-muted hover:text-lr-text'
          }`}
        >
          Magic link
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-caption">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            required
            className="h-10 bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted"
          />
        </div>

        {mode === 'password' && (
          <div className="space-y-2">
            <Label htmlFor="password" className="text-caption">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              required
              className="h-10 bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted"
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <Button
          type="submit"
          disabled={isPending || !email || (mode === 'password' && !password)}
          className="w-full bg-lr-accent hover:bg-lr-accent/90 text-white h-10"
        >
          {isPending
            ? mode === 'magic' ? 'Sending…' : 'Signing in…'
            : mode === 'magic' ? 'Send magic link' : 'Sign in'}
        </Button>

        <p className="text-center text-xs text-lr-muted">
          {mode === 'magic'
            ? "Enter your email — we'll send a one-click sign-in link."
            : 'Sign in with your email and password.'}
        </p>
      </form>
    </div>
  )
}
