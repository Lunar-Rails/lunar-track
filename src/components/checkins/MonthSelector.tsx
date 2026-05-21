'use client'

import { useRouter } from 'next/navigation'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface MonthOption {
  month: number
  year: number
  hasCheckin: boolean
}

interface MonthSelectorProps {
  periodId: string
  selectedMonth: number
  selectedYear: number
  options: MonthOption[]
}

export default function MonthSelector({
  periodId,
  selectedMonth,
  selectedYear,
  options,
}: MonthSelectorProps) {
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [year, month] = e.target.value.split('-')
    router.push(`/checkins/new?periodId=${periodId}&month=${month}&year=${year}`)
  }

  return (
    <select
      value={`${selectedYear}-${selectedMonth}`}
      onChange={handleChange}
      className="h-9 rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface px-3 text-sm text-lr-text focus:outline-none focus:ring-1 focus:ring-lr-accent cursor-pointer"
    >
      {options.map(({ month, year, hasCheckin }) => (
        <option key={`${year}-${month}`} value={`${year}-${month}`}>
          {MONTH_NAMES[month - 1]} {year}{hasCheckin ? ' (saved)' : ''}
        </option>
      ))}
    </select>
  )
}
