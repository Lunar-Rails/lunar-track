'use client'

import { useState, useRef, useEffect } from 'react'
import { CalendarPlus, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ScheduleCallButtonProps {
  title: string
  description?: string
  managerEmail?: string | null
}

type Recurrence = 'once' | 'weekly' | 'biweekly' | 'monthly'

const RECURRENCE_OPTIONS: { value: Recurrence; label: string; rrule: string | null }[] = [
  { value: 'once',     label: 'One-time',        rrule: null },
  { value: 'weekly',   label: 'Weekly',           rrule: 'RRULE:FREQ=WEEKLY' },
  { value: 'biweekly', label: 'Every 2 weeks',    rrule: 'RRULE:FREQ=WEEKLY;INTERVAL=2' },
  { value: 'monthly',  label: 'Monthly',          rrule: 'RRULE:FREQ=MONTHLY' },
]

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

export default function ScheduleCallButton({ title, description, managerEmail }: ScheduleCallButtonProps) {
  const [open, setOpen] = useState(false)
  const [recurrence, setRecurrence] = useState<Recurrence>('once')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function schedule() {
    const { start, end } = nextWeekdayAt10()
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${start}/${end}`,
    })
    if (description) params.set('details', description)
    if (managerEmail) params.set('add', managerEmail)
    const rrule = RECURRENCE_OPTIONS.find((o) => o.value === recurrence)?.rrule
    if (rrule) params.set('recur', rrule)
    window.open(
      `https://calendar.google.com/calendar/render?${params.toString()}`,
      '_blank',
      'noopener,noreferrer',
    )
    setOpen(false)
  }

  const selectedLabel = RECURRENCE_OPTIONS.find((o) => o.value === recurrence)?.label ?? 'One-time'

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
        <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-bg shadow-[var(--shadow-lr-dropdown)] p-3 space-y-3">
          <p className="text-xs font-semibold text-lr-text">Recurrence</p>
          <div className="space-y-1">
            {RECURRENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRecurrence(opt.value)}
                className={[
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-[var(--radius-lr)] text-xs transition-colors',
                  recurrence === opt.value
                    ? 'bg-lr-accent-dim text-lr-accent font-medium'
                    : 'text-lr-text hover:bg-lr-surface',
                ].join(' ')}
              >
                {opt.label}
                {recurrence === opt.value && <Check className="h-3 w-3" />}
              </button>
            ))}
          </div>
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
      )}
    </div>
  )
}
