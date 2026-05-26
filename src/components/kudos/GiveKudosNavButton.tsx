'use client'

import { useState } from 'react'
import { Heart, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getKudosFormData } from '@/lib/actions/kudos-actions'
import SendKudosSheet from './SendKudosSheet'

export default function GiveKudosNavButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{
    profiles: { id: string; full_name: string | null; email: string; avatar_url: string | null }[]
    companyValues: { id: string; name: string }[]
  } | null>(null)

  async function handleClick() {
    if (loading) return
    try {
      setLoading(true)
      if (!data) {
        const result = await getKudosFormData()
        setData(result)
      }
      setOpen(true)
    } catch (err) {
      console.error('[GiveKudosNavButton] failed to load form data', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          'flex w-full items-center gap-3 rounded-[var(--radius-lr)] px-3 py-2 text-sm font-medium transition-colors duration-150',
          'text-lr-muted hover:text-lr-text hover:bg-lr-surface disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {loading
          ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          : <Heart className="h-4 w-4 shrink-0" />
        }
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
