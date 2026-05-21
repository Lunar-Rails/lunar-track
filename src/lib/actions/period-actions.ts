'use server'

import { createClient } from '@/lib/supabase/server'

const QUARTERS = [
  { quarter: 1, start_date_suffix: '-01-01', end_date_suffix: '-03-31' },
  { quarter: 2, start_date_suffix: '-04-01', end_date_suffix: '-06-30' },
  { quarter: 3, start_date_suffix: '-07-01', end_date_suffix: '-09-30' },
  { quarter: 4, start_date_suffix: '-10-01', end_date_suffix: '-12-31' },
]

/**
 * Called from the protected layout on every authenticated page load.
 * 1. Creates all 4 quarters for the current year if they don't exist yet.
 * 2. Ensures the correct quarter is open (closes any stale open period, opens the current one).
 * Fully idempotent — safe to call on every request.
 */
export async function ensureCurrentPeriod(): Promise<void> {
  const supabase = await createClient()

  const now = new Date()
  const year = now.getFullYear()
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3)

  // Fetch existing periods for this year
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingRaw } = await (supabase as any)
    .from('performance_periods')
    .select('id, quarter, status')
    .eq('year', year)

  type MinPeriod = { id: string; quarter: number; status: 'open' | 'closed' }
  const existing = (existingRaw ?? []) as MinPeriod[]
  const existingQuarters = new Set(existing.map((p) => p.quarter))

  // Insert any missing quarters
  const toInsert = QUARTERS.filter((q) => !existingQuarters.has(q.quarter)).map((q) => ({
    name: `Q${q.quarter} ${year}`,
    year,
    quarter: q.quarter,
    start_date: `${year}${q.start_date_suffix}`,
    end_date: `${year}${q.end_date_suffix}`,
    status: q.quarter === currentQuarter ? ('open' as const) : ('closed' as const),
  }))

  if (toInsert.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('performance_periods').insert(toInsert)
  }

  // Re-fetch after potential inserts to get fresh state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: freshRaw } = await (supabase as any)
    .from('performance_periods')
    .select('id, quarter, status')
    .eq('year', year)
  const fresh = (freshRaw ?? []) as MinPeriod[]

  const currentPeriod = fresh.find((p) => p.quarter === currentQuarter)
  const staleOpenPeriods = fresh.filter((p) => p.quarter !== currentQuarter && p.status === 'open')

  // Close any period that should no longer be open
  for (const stale of staleOpenPeriods) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('performance_periods')
      .update({ status: 'closed' })
      .eq('id', stale.id)
  }

  // Open the current quarter's period if it isn't already
  if (currentPeriod && currentPeriod.status !== 'open') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('performance_periods')
      .update({ status: 'open' })
      .eq('id', currentPeriod.id)
  }
}
