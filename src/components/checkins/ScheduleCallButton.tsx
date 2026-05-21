'use client'

import { useState, useRef, useEffect } from 'react'
import { CalendarPlus, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ScheduleCallButtonProps {
  title: string
  description?: string
  managerEmail?: string | null
  recurrenceLabel: string
  recurrenceRule: string
}

function nextWeekdayAt10(): { start: string; end: string } {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  const day = d.getDay()
  if (day === 0) d.setDate(d.getDate() + 1)
  if (day === 6) d.setDate(d.getDate() + 2)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  return { start: `${date}T100000`, end: `${date}T110000` }
}

export default function ScheduleCallButton({
  title, description, managerEmail, recurrenceLabel, recurrenceRule,
}: ScheduleCallButtonProps) {
  const [open, setOpen] = useState(false)
  const [recurring, setRecurring] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function schedule() {
    const { start, end } = nextWeekdayAt10()
    const params = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${start}/${end}` })
    if (description) params.set('details', description)
    if (managerEmail) params.set('add', managerEmail)
    if (recurring) params.set('recur', recurrenceRule)
    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5 border-lr-border text-lr-text hover:bg-lr-surface text-xs shrink-0"
      >
        <CalendarPlus className="h-3.5 w-3.5" />
        Schedule call
        <ChevronDown className={['h-3 w-3 transition-transform', open ? 'rotate-180' : ''].join(' ')} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-bg shadow-lg p-2 space-y-1.5">
          <p className="text-[11px] font-semibold text-lr-muted uppercase tracking-wide px-2 pt-1">Recurrence</p>
          {[
            { value: false, label: 'One-time' },
            { value: true,  label: recurrenceLabel },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setRecurring(opt.value)}
              className={[
                'w-full flex items-center justify-between px-2.5 py-2 rounded-[var(--radius-lr)] text-sm transition-colors',
                recurring === opt.value
                  ? 'bg-lr-accent-dim text-lr-accent font-medium'
                  : 'text-lr-text hover:bg-lr-surface',
              ].join(' ')}
            >
              {opt.label}
              {recurring === opt.value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
          <div className="pt-1 border-t border-lr-border">
            <Button
              type="button"
              size="sm"
              onClick={schedule}
              className="w-full bg-lr-accent hover:bg-lr-accent/90 text-white text-xs gap-1.5"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Open in Google Calendar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
