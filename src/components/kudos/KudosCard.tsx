'use client'

import { formatDistanceToNow } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Kudo } from '@/lib/actions/kudos-actions'

function getInitials(name: string | null, email: string): string {
  if (name) return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

interface KudosCardProps {
  kudo: Kudo
  showRecipient?: boolean
  showSender?: boolean
}

export default function KudosCard({ kudo, showRecipient, showSender }: KudosCardProps) {
  const person = showSender ? kudo.sender : showRecipient ? kudo.recipient : null
  const personName = person?.full_name ?? person?.email ?? 'Someone'
  const personEmail = person?.email ?? ''

  const timeAgo = formatDistanceToNow(new Date(kudo.created_at), { addSuffix: true })

  return (
    <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] px-4 py-3 space-y-2">
      <div className="flex items-center gap-2.5">
        {person && (
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={person.avatar_url ?? undefined} />
            <AvatarFallback className="bg-lr-accent text-white text-xs">
              {getInitials(person.full_name, personEmail)}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-lr-text font-medium">{personName}</span>
          {showSender && <span className="text-sm text-lr-muted"> sent you kudos</span>}
          {showRecipient && <span className="text-sm text-lr-muted"> received kudos</span>}
        </div>
        <span className="text-xs text-lr-muted shrink-0">{timeAgo}</span>
      </div>

      <div className="pl-9 space-y-1.5">
        <span className="inline-flex items-center rounded-full bg-lr-accent-dim text-lr-accent border border-lr-accent/20 text-xs px-2 py-0.5">
          {kudo.value_name}
        </span>
        <p className="text-sm text-lr-muted leading-relaxed">&ldquo;{kudo.note}&rdquo;</p>
      </div>
    </div>
  )
}
