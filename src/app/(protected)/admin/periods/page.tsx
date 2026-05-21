import { createClient } from '@/lib/supabase/server'
import PeriodsManager from '@/components/admin/PeriodsManager'
import CreatePeriodForm from '@/components/admin/CreatePeriodForm'
import { Separator } from '@/components/ui/separator'
import type { PerformancePeriod } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export default async function PeriodsPage() {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: periodsRaw } = await (supabase as any)
    .from('performance_periods')
    .select('*')
    .order('year', { ascending: false })
    .order('quarter', { ascending: true })

  const periods = (periodsRaw ?? []) as PerformancePeriod[]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-page-title">Performance Periods</h1>
        <p className="text-body text-lr-muted mt-1">
          Control which quarter is active across the entire platform. Q1–Q4 for the current year are auto-created on your first admin visit.
        </p>
      </div>

      {/* How it works info box */}
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 space-y-4">
        <h2 className="text-card-title">How performance periods work</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-section-label text-lr-accent">Open period</p>
            <p className="text-caption text-lr-muted">
              Employees can create and submit OKRs. Check-ins are available. Managers can review OKRs and fill in post-meeting notes. Only one period should be open at a time.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-section-label text-lr-accent">Closing a period</p>
            <p className="text-caption text-lr-muted">
              Locks the quarter. No new OKRs or check-ins can be submitted. Use this at the end of each quarter before opening the next one. Scores and reviews already entered are preserved.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-section-label text-lr-accent">Reopening</p>
            <p className="text-caption text-lr-muted">
              You can reopen a closed period at any time if corrections are needed. Use with caution — it allows new submissions for that quarter again.
            </p>
          </div>
        </div>
        <div className="border-t border-lr-border pt-4">
          <p className="text-section-label text-lr-muted mb-2">Recommended quarter-end workflow</p>
          <ol className="text-caption text-lr-muted space-y-1 list-decimal list-inside">
            <li>Ensure all employees have submitted their monthly check-ins for the quarter</li>
            <li>Managers complete OKR reviews and quarterly scores for each direct report</li>
            <li>HR reviews scores and marks them visible to employees when ready</li>
            <li>Close the current period, then open (or create) the next quarter</li>
          </ol>
        </div>
      </div>

      <PeriodsManager periods={periods} />

      <Separator className="bg-lr-border" />

      <div>
        <h2 className="text-card-title mb-4">Create New Period</h2>
        <div className="max-w-lg rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-6 shadow-[var(--shadow-lr-card)]">
          <CreatePeriodForm />
        </div>
      </div>
    </div>
  )
}
