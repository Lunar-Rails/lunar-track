'use client'

import { useTransition, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-react'
import { upsertCheckinManager } from '@/lib/actions/checkin-actions'
import type { Checkin, Mit } from '@/lib/types/database'

const schema = z.object({
  mgr_mit_notes: z.string().max(3000).optional(),
  mgr_done_well: z.string().max(3000).optional(),
  mgr_do_differently: z.string().max(3000).optional(),
  mgr_support_commitments: z.string().max(3000).optional(),
})

type FormValues = z.infer<typeof schema>

interface ManagerCheckinFormProps {
  checkin: Checkin
  readOnly?: boolean
}

function initNextMits(checkin: Checkin): Mit[] {
  if (checkin.mgr_next_mits && checkin.mgr_next_mits.length > 0) return checkin.mgr_next_mits
  // Build from legacy fixed fields
  const result: Mit[] = []
  if (checkin.mgr_next_mit_1_title) result.push({ title: checkin.mgr_next_mit_1_title, description: checkin.mgr_next_mit_1_description ?? '' })
  if (checkin.mgr_next_mit_2_title) result.push({ title: checkin.mgr_next_mit_2_title, description: checkin.mgr_next_mit_2_description ?? '' })
  if (checkin.mgr_next_mit_3_title) result.push({ title: checkin.mgr_next_mit_3_title, description: checkin.mgr_next_mit_3_description ?? '' })
  if (result.length > 0) return result
  // NEW: fall back to employee's planned next_mits as pre-fill
  if (checkin.next_mits && checkin.next_mits.length > 0) {
    const prefilled = checkin.next_mits
      .filter((m) => m.title.trim())
      .map((m) => ({ title: m.title, description: m.description }))
    if (prefilled.length > 0) return prefilled
  }
  return [{ title: '', description: '' }]
}

export default function ManagerCheckinForm({ checkin, readOnly = false }: ManagerCheckinFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [nextMits, setNextMits] = useState<Mit[]>(() => initNextMits(checkin))

  const { register, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mgr_mit_notes: checkin.mgr_mit_notes ?? '',
      mgr_done_well: checkin.mgr_done_well ?? '',
      mgr_do_differently: checkin.mgr_do_differently ?? '',
      mgr_support_commitments: checkin.mgr_support_commitments ?? '',
    },
  })

  function addNextMit() {
    setNextMits((prev) => [...prev, { title: '', description: '' }])
  }

  function removeNextMit(index: number) {
    setNextMits((prev) => prev.filter((_, i) => i !== index))
  }

  function updateNextMit(index: number, field: keyof Mit, value: string) {
    setNextMits((prev) => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }

  function buildFormData(values: FormValues, submit: boolean): FormData {
    const fd = new FormData()
    fd.append('checkinId', checkin.id)
    fd.append('mgr_next_mits', JSON.stringify(nextMits.filter((m) => m.title.trim())))
    if (submit) fd.append('submit', 'true')
    Object.entries(values).forEach(([k, v]) => {
      if (v) fd.append(k, v)
    })
    return fd
  }

  function onSave(values: FormValues) {
    setError(null)
    startTransition(async () => {
      const result = await upsertCheckinManager(buildFormData(values, false))
      if ('error' in result) setError(result.error)
      else setSavedAt(new Date())
    })
  }

  function onSubmit(values: FormValues) {
    setError(null)
    startTransition(async () => {
      const result = await upsertCheckinManager(buildFormData(values, true))
      if ('error' in result) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      {readOnly && (
        <div className="rounded-[var(--radius-lr)] border border-lr-accent/20 bg-lr-accent-dim px-4 py-3 text-sm text-lr-accent">
          Manager section completed.
        </div>
      )}

      <form onSubmit={handleSubmit(onSave)} className="space-y-6">
        {/* MIT notes */}
        <div className="space-y-1">
          <Label htmlFor="mgr_mit_notes" className="text-caption">MIT Notes</Label>
          <p className="text-xs text-lr-muted mb-2">Your observations on the employee's MITs for this period.</p>
          <Textarea
            id="mgr_mit_notes"
            {...register('mgr_mit_notes')}
            disabled={readOnly || isPending}
            placeholder="Notes on the employee's most important things…"
            className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[100px] resize-y"
          />
        </div>

        {/* Reflections */}
        {[
          { name: 'mgr_done_well', label: "What did they do well?", placeholder: "Manager's perspective on wins…" },
          { name: 'mgr_do_differently', label: "What should they do differently?", placeholder: "Constructive feedback…" },
          { name: 'mgr_support_commitments', label: "Support commitments", placeholder: "What will you do to support this employee?" },
        ].map(({ name, label, placeholder }) => (
          <div key={name} className="space-y-1">
            <Label htmlFor={name} className="text-caption">{label}</Label>
            <Textarea
              id={name}
              {...register(name as keyof FormValues)}
              disabled={readOnly || isPending}
              placeholder={placeholder}
              className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[100px] resize-y"
            />
          </div>
        ))}

        {/* Employee's planned MITs — read-only context */}
        {(checkin.next_mits ?? []).filter((m) => m.title.trim()).length > 0 && (
          <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface/50 p-4 space-y-2">
            <p className="text-xs font-semibold text-lr-text">Employee&apos;s planned commitments for next month</p>
            <p className="text-[11px] text-lr-muted">These are what the employee committed in their plan tab. Use as a starting point.</p>
            <ul className="space-y-1.5 mt-2">
              {(checkin.next_mits ?? []).filter((m) => m.title.trim()).map((m, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[11px] font-mono text-lr-accent shrink-0 mt-0.5">{i + 1}</span>
                  <div>
                    <p className="text-xs text-lr-text font-medium">{m.title}</p>
                    {m.description && <p className="text-[11px] text-lr-muted">{m.description}</p>}
                    {m.okr_label && <p className="text-[11px] text-lr-accent/70 mt-0.5">Goal: {m.okr_label}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Next Month's MITs — dynamic */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-card-title">Next Month&apos;s MITs</h3>
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addNextMit}
                className="gap-1.5 border-lr-accent text-lr-accent hover:bg-lr-accent-dim text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Add MIT
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {nextMits.map((mit, index) => (
              <div key={index} className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-section-label">MIT {index + 1}</p>
                  {!readOnly && nextMits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeNextMit(index)}
                      className="text-lr-muted hover:text-lr-error transition-colors"
                      aria-label="Remove MIT"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-caption">Title</Label>
                  <Input
                    value={mit.title}
                    onChange={(e) => updateNextMit(index, 'title', e.target.value)}
                    disabled={readOnly || isPending}
                    placeholder={`MIT ${index + 1} for next month`}
                    className="bg-lr-surface border-lr-border text-lr-text text-sm h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-caption">Description</Label>
                  <Textarea
                    value={mit.description}
                    onChange={(e) => updateNextMit(index, 'description', e.target.value)}
                    disabled={readOnly || isPending}
                    placeholder="Context or success criteria…"
                    className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[80px] resize-y"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {error && (
          <div className="rounded-[var(--radius-lr)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!readOnly && (
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={isPending}
              variant="outline"
              className="border-lr-border text-lr-text hover:bg-lr-surface"
            >
              {isPending ? 'Saving…' : 'Save Draft'}
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={handleSubmit(onSubmit)}
              className="bg-lr-accent hover:bg-lr-accent/90 text-white"
            >
              {isPending ? 'Submitting…' : 'Complete Check-in'}
            </Button>
            {savedAt && (
              <span className="text-xs text-lr-muted">Saved {savedAt.toLocaleTimeString()}</span>
            )}
          </div>
        )}
      </form>
    </div>
  )
}
