import Link from 'next/link'
import { CheckCircle2, Clock, Circle } from 'lucide-react'
import type { SubordinateRow } from '@/lib/types/database'

interface CheckinStatus {
  employeeSubmitted: boolean
  managerSubmitted: boolean
}

interface TeamReadinessProps {
  directReports: SubordinateRow[]
  checkinStatusMap: Record<string, CheckinStatus>
}

export default function TeamReadiness({ directReports, checkinStatusMap }: TeamReadinessProps) {
  if (directReports.length === 0) return null

  return (
    <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-lr-text">Team This Month</h2>
        <Link href="/checkins" className="text-xs text-lr-muted hover:text-lr-text transition-colors">
          All check-ins →
        </Link>
      </div>
      <div className="space-y-1">
        {directReports.map((report) => {
          const status = checkinStatusMap[report.id]
          const done = status?.managerSubmitted
          const pending = status?.employeeSubmitted && !status?.managerSubmitted
          return (
            <Link
              key={report.id}
              href={`/team/${report.id}`}
              className="flex items-center justify-between py-1.5 px-2 rounded-[var(--radius-lr)] hover:bg-lr-surface transition-colors group"
            >
              <span className="text-sm text-lr-text truncate group-hover:text-lr-accent transition-colors">
                {report.full_name ?? report.email}
              </span>
              <span
                className={`flex items-center gap-1.5 text-xs shrink-0 ml-3 ${
                  done
                    ? 'text-lr-success'
                    : pending
                    ? 'text-lr-gold'
                    : 'text-lr-muted'
                }`}
              >
                {done ? (
                  <><CheckCircle2 className="h-3.5 w-3.5" />Done</>
                ) : pending ? (
                  <><Clock className="h-3.5 w-3.5" />Review</>
                ) : (
                  <><Circle className="h-3.5 w-3.5" />Waiting</>
                )}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
