'use client'

import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ScheduleCallButtonProps {
  title: string
  description?: string
  managerEmail?: string | null
}

function nextWeekdayAt10(): { start: string; end: string } {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  // snap to next Monday if needed
  const day = d.getDay()
  if (day === 0) d.setDate(d.getDate() + 1)
  if (day === 6) d.setDate(d.getDate() + 2)

  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  return {
    start: `${date}T100000`,
    end: `${date}T110000`,
  }
}

export default function ScheduleCallButton({ title, description, managerEmail }: ScheduleCallButtonProps) {
  function openCalendar() {
    const { start, end } = nextWeekdayAt10()
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${start}/${end}`,
    })
    if (description) params.set('details', description)
    if (managerEmail) params.set('add', managerEmail)

    window.open(
      `https://calendar.google.com/calendar/render?${params.toString()}`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={openCalendar}
      className="gap-1.5 border-lr-border text-lr-text hover:bg-lr-surface text-xs shrink-0"
    >
      <CalendarPlus className="h-3.5 w-3.5" />
      Schedule call
    </Button>
  )
}
