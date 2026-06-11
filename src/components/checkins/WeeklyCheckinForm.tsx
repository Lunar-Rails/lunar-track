'use client'

import { useTransition, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { upsertWeeklyCheckin } from '@/lib/actions/weekly-actions'
import type { WeeklyCheckin, WeeklyPlanTask } from '@/lib/types/database'

export interface MitOption { id: string; label: string }

interface Props {
  weekStart: string
  existing: WeeklyCheckin | null
  mitOptions: MitOption[]
  readOnly?: boolean
}

const UNLINKED = '__unlinked__'

export default function WeeklyCheckinForm({ weekStart, existing, mitOptions, readOnly = false }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const [progress, setProgress] = useState(existing?.progress ?? '')
  const [problems, setProblems] = useState(existing?.problems ?? '')
  const [lastMinute, setLastMinute] = useState(existing?.last_minute_requests ?? '')
  const [plan, setPlan] = useState<WeeklyPlanTask[]>(
    existing?.plan_tasks?.length ? existing.plan_tasks : [{ title: '', mit_id: null, mit_label: null }]
  )

  function updateTask(i: number, patch: Partial<WeeklyPlanTask>) {
    setPlan(plan.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  }
  function addTask() { if (plan.length < 2) setPlan([...plan, { title: '', mit_id: null, mit_label: null }]) }
  function removeTask(i: number) { setPlan(plan.filter((_, idx) => idx !== i)) }
  function onLink(i: number, id: string) {
    if (id === UNLINKED) updateTask(i, { mit_id: null, mit_label: null })
    else updateTask(i, { mit_id: id, mit_label: mitOptions.find((o) => o.id === id)?.label ?? null })
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('weekStart', weekStart)
      fd.set('progress', progress)
      fd.set('problems', problems)
      fd.set('last_minute_requests', lastMinute)
      fd.set('plan_tasks', JSON.stringify(plan.filter((t) => t.title.trim())))
      const result = await upsertWeeklyCheckin(fd)
      if ('error' in result) { setError(result.error); return }
      setSavedAt(new Date())
      if (result.id && !pathname.includes(result.id)) {
        router.push(`/weekly-checkins/${result.id}`)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Progress */}
      <section className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-5 space-y-2">
        <Label className="text-section-label">Progress <span className="text-lr-muted">— update from last week</span></Label>
        <Textarea value={progress} onChange={(e) => setProgress(e.target.value)} disabled={readOnly || isPending}
          maxLength={4000} rows={3} placeholder="What moved forward since last week?"
          className="bg-lr-surface border-lr-border text-lr-text text-sm resize-y" />
      </section>

      {/* WIT — Wildly Important Tasks (max 2) */}
      <section className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-5 space-y-3">
        <div>
          <Label className="text-section-label">WIT <span className="text-lr-muted">— Wildly Important Tasks (your top 1–2 this week)</span></Label>
        </div>
        {plan.map((t, i) => (
          <div key={i} className="rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Input value={t.title} onChange={(e) => updateTask(i, { title: e.target.value })} disabled={readOnly || isPending}
                maxLength={300} placeholder="Your Wildly Important Task" className="bg-lr-surface border-lr-border text-lr-text text-sm h-9" />
              {!readOnly && plan.length > 1 && (
                <button type="button" onClick={() => removeTask(i)} className="mt-1 text-lr-muted hover:text-lr-error" aria-label="Remove task">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-caption">Monthly MIT</Label>
              {mitOptions.length > 0 ? (
                <Select value={t.mit_id ?? UNLINKED} onValueChange={(v) => onLink(i, v)} disabled={readOnly || isPending}>
                  <SelectTrigger className="bg-lr-surface border-lr-border text-lr-text text-sm h-9"><SelectValue placeholder="Link to a monthly MIT…" /></SelectTrigger>
                  <SelectContent side="bottom" position="popper" avoidCollisions={false} sideOffset={4}
                    className="bg-lr-bg border border-lr-border shadow-[var(--shadow-lr-dropdown)] min-w-[var(--radix-select-trigger-width)]">
                    {mitOptions.map((o) => (<SelectItem key={o.id} value={o.id} className="text-lr-text text-sm py-2.5 pl-3 pr-8">{o.label}</SelectItem>))}
                    <SelectItem value={UNLINKED} className="text-sm py-2.5 pl-3 pr-8"><span className="text-lr-muted italic">Not linked to a monthly MIT</span></SelectItem>
                  </SelectContent>
                </Select>
              ) : t.mit_id ? (
                <p className="text-xs text-lr-accent">MIT: {t.mit_label ?? t.mit_id}</p>
              ) : (
                <p className="text-xs text-lr-muted italic">No monthly MITs yet — set them in your monthly check-in to link here.</p>
              )}
            </div>
          </div>
        ))}
        {!readOnly && plan.length < 2 && (
          <Button type="button" variant="outline" size="sm" onClick={addTask}
            className="w-full gap-1.5 border-lr-accent text-lr-accent hover:bg-lr-accent-dim text-xs">
            <Plus className="h-3.5 w-3.5" /> Add WIT
          </Button>
        )}
      </section>

      {/* Problem */}
      <section className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-5 space-y-3">
        <div className="space-y-1">
          <Label className="text-section-label">Problem</Label>
          <Textarea value={problems} onChange={(e) => setProblems(e.target.value)} disabled={readOnly || isPending}
            maxLength={4000} rows={3} placeholder="What's blocking or at risk?"
            className="bg-lr-surface border-lr-border text-lr-text text-sm resize-y" />
        </div>
        <div className="space-y-1">
          <Label className="text-caption">Last-minute requests this week</Label>
          <Textarea value={lastMinute} onChange={(e) => setLastMinute(e.target.value)} disabled={readOnly || isPending}
            maxLength={4000} rows={2} placeholder="Unplanned asks that came in this week"
            className="bg-lr-surface border-lr-border text-lr-text text-sm resize-y" />
        </div>
      </section>

      {error && (<div className="rounded-[var(--radius-lr)] border border-lr-error/20 bg-lr-error-dim px-4 py-3 text-sm text-lr-error">{error}</div>)}

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={save} disabled={isPending} className="bg-lr-accent hover:bg-lr-accent/90 text-white">
            {isPending ? 'Saving…' : 'Save'}
          </Button>
          {savedAt && <span className="text-xs text-lr-success">Saved {savedAt.toLocaleTimeString()}</span>}
        </div>
      )}
    </div>
  )
}
