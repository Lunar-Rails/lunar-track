'use client'

import { useRouter } from 'next/navigation'

interface Period {
  id: string
  name: string
  status: string
}

interface PeriodFilterProps {
  periods: Period[]
  selectedId: string | undefined
  basePath: string
}

export default function PeriodFilter({ periods, selectedId, basePath }: PeriodFilterProps) {
  const router = useRouter()

  return (
    <select
      value={selectedId ?? ''}
      onChange={(e) => router.push(`${basePath}?period=${e.target.value}`)}
      className="rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface text-lr-text text-sm px-3 py-2 cursor-pointer"
    >
      {periods.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}{p.status === 'open' ? ' (open)' : ''}
        </option>
      ))}
    </select>
  )
}
