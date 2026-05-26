'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getKudosFormData } from '@/lib/actions/kudos-actions'
import SendKudosSheet from './SendKudosSheet'

export default function GiveKudosNavButton() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<{
    profiles: { id: string; full_name: string | null; email: string; avatar_url: string | null }[]
    companyValues: { id: string; name: string }[]
  } | null>(null)

  async function handleClick() {
    if (!data) {
      const result = await getKudosFormData()
      setData(result)
    }
    setOpen(true)
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          'flex w-full items-center gap-3 rounded-[var(--radius-lr)] px-3 py-2 text-sm font-medium transition-colors duration-150',
          'text-lr-muted hover:text-lr-text hover:bg-lr-surface'
        )}
      >
        <Heart className="h-4 w-4 shrink-0" />
        Give kudos
      </button>

      {data && (
        <SendKudosSheet
          profiles={data.profiles}
          companyValues={data.companyValues}
          open={open}
          onOpenChange={setOpen}
        >
          <span className="hidden" />
        </SendKudosSheet>
      )}
    </>
  )
}
