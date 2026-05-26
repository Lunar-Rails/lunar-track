'use client'

import { useState, useTransition } from 'react'
import { UserPlus, X, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { inviteTeamMember } from '@/lib/actions/team-actions'

export default function InviteTeamMember() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successEmail, setSuccessEmail] = useState<string | null>(null)

  function handleClose() {
    setOpen(false)
    setEmail('')
    setError(null)
    setSuccessEmail(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData()
    formData.set('email', email)
    startTransition(async () => {
      const result = await inviteTeamMember(formData)
      if ('error' in result) {
        setError(result.error)
      } else {
        setSuccessEmail(result.email)
        setEmail('')
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-medium text-lr-accent border border-lr-accent/30 bg-lr-accent-dim hover:bg-lr-accent/20 rounded-[var(--radius-lr)] px-4 py-2 transition-colors shrink-0"
      >
        <UserPlus className="h-4 w-4" />
        Add team member
      </button>
    )
  }

  return (
    <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-lr-accent" />
          <span className="text-sm font-semibold text-lr-text">Invite new team member</span>
        </div>
        <button onClick={handleClose} className="text-lr-muted hover:text-lr-text transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {successEmail ? (
        <div className="flex items-start gap-3 py-1">
          <CheckCircle className="h-4 w-4 text-lr-success mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm text-lr-text">
              Invitation sent to <strong>{successEmail}</strong>
            </p>
            <p className="text-xs text-lr-muted">
              They'll receive an email to join CiaoBob. Once they sign in, they'll appear as your direct report.
            </p>
            <button
              onClick={() => setSuccessEmail(null)}
              className="text-xs text-lr-accent hover:underline mt-1"
            >
              Invite another
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="newcolleague@company.com"
            disabled={isPending}
            required
            className="h-9 flex-1 bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted text-sm"
          />
          <Button
            type="submit"
            disabled={isPending || !email}
            className="h-9 bg-lr-accent hover:bg-lr-accent/90 text-white text-sm px-4 shrink-0"
          >
            {isPending ? 'Sending…' : 'Send invite'}
          </Button>
        </form>
      )}

      {error && <p className="text-xs text-lr-error mt-2">{error}</p>}

      {!successEmail && (
        <p className="text-xs text-lr-muted mt-2">
          They'll be added to your team and receive an email invitation to sign in with their work Google account.
        </p>
      )}
    </div>
  )
}
