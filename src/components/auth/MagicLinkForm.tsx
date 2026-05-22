'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isAllowedEmail, DOMAIN_ERROR_MESSAGE } from '@/lib/auth/allowed-domains'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function MagicLinkForm() {
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setError(null)
    startTransition(async () => {
      if (!isAllowedEmail(email)) {
        setError(DOMAIN_ERROR_MESSAGE)
        return
      }
      const supabase = createClient()
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
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email address</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          required
          className="h-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:ring-violet-500"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <Button
        type="submit"
        disabled={isPending || !email}
        className="w-full bg-lr-accent hover:bg-lr-accent/90 text-white h-10"
      >
        {isPending ? 'Sending…' : 'Send magic link'}
      </Button>

      <p className="text-center text-xs text-gray-400">
        Enter your email — we&apos;ll send a one-click sign-in link.
      </p>
    </form>
  )
}
