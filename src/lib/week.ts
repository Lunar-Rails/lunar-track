// Pure date helpers for the weekly check-in. All inputs/outputs are
// 'YYYY-MM-DD' strings parsed in UTC to avoid timezone drift.

function pad(n: number): string { return String(n).padStart(2, '0') }
function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Monday (work-week start) of the week containing `dateISO` ('YYYY-MM-DD'). */
export function mondayOf(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`)
  const dow = d.getUTCDay() // 0=Sun..6=Sat
  const delta = dow === 0 ? -6 : 1 - dow // shift back to Monday
  d.setUTCDate(d.getUTCDate() + delta)
  return toISO(d)
}

/** Half-open ISO date range [start, endExclusive) covering a calendar month. */
export function monthRange(year: number, month: number): { start: string; endExclusive: string } {
  const start = `${year}-${pad(month)}-01`
  const ny = month === 12 ? year + 1 : year
  const nm = month === 12 ? 1 : month + 1
  return { start, endExclusive: `${ny}-${pad(nm)}-01` }
}
