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
import { finalizeAnnualScore } from '@/lib/actions/performance-actions'
import type { AnnualScore } from '@/lib/types/database'

const schema = z.object({
  final_professional_mastery: z.number().min(1).max(5).optional(),
  final_okrs_stretch_goals: z.number().min(1).max(5).optional(),
  final_behaviours_values: z.number().min(1).max(5).optional(),
  override_rationale: z.string().max(3000).optional(),
})

type FormValues = z.infer<typeof schema>

interface AnnualScoreFormProps {
  employeeId: string
  employeeName: string
  year: number
  suggested: {
    professional_mastery: number | null
    okrs_stretch_goals: number | null
    behaviours_values: number | null
  }
  existing: AnnualScore | null
}

export default function AnnualScoreForm({
  employeeId,
  employeeName,
  year,
  suggested,
  existing,
}: AnnualScoreFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const { register, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      final_professional_mastery: existing?.final_professional_mastery ?? undefined,
      final_okrs_stretch_goals: existing?.final_okrs_stretch_goals ?? undefined,
      final_behaviours_values: existing?.final_behaviours_values ?? undefined,
      override_rationale: existing?.override_rationale ?? '',
    },
  })

  function onSave(values: FormValues) {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('employeeId', employeeId)
      fd.append('year', String(year))
      if (values.final_professional_mastery) fd.append('final_professional_mastery', String(values.final_professional_mastery))
      if (values.final_okrs_stretch_goals) fd.append('final_okrs_stretch_goals', String(values.final_okrs_stretch_goals))
      if (values.final_behaviours_values) fd.append('final_behaviours_values', String(values.final_behaviours_values))
      if (values.override_rationale) fd.append('override_rationale', values.override_rationale)

      const result = await finalizeAnnualScore(fd)
      if ('error' in result) setError(result.error)
      else {
        setSaved(true)
        router.refresh()
      }
    })
  }

  const components = [
    { key: 'professional_mastery' as const, label: 'Professional Mastery' },
    { key: 'okrs_stretch_goals' as const, label: 'OKRs / Stretch Goals' },
    { key: 'behaviours_values' as const, label: 'Behaviours / Values' },
  ]

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-6">
      <div className="rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface px-4 py-3 text-sm text-lr-muted">
        Suggested scores are averaged from completed quarterly scores. Leave override blank to accept the suggestion.
      </div>

      <div className="space-y-4">
        {components.map(({ key, label }) => (
          <div key={key} className="grid grid-cols-2 gap-4 items-center rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4">
            <div>
              <p className="text-sm font-medium text-lr-text">{label}</p>
              <p className="text-xs text-lr-muted mt-0.5">
                Suggested: <strong className="text-lr-text">{suggested[key]?.toFixed(2) ?? '—'}</strong>
              </p>
              {existing && existing[`final_${key}` as keyof AnnualScore] && (
                <p className="text-xs text-lr-cyan mt-0.5">
                  Current final: {String(existing[`final_${key}` as keyof AnnualScore])}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`final_${key}`} className="text-caption">Override (optional)</Label>
              <Input
                id={`final_${key}`}
                type="number"
                step="0.1"
                min="1"
                max="5"
                {...register(`final_${key}` as keyof FormValues, { valueAsNumber: true })}
                disabled={isPending}
                placeholder={suggested[key]?.toFixed(2) ?? 'No data'}
                className="bg-lr-surface border-lr-border text-lr-text text-sm h-9"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Overall preview */}
      {existing?.final_overall && (
        <div className="rounded-[var(--radius-lr-lg)] border border-lr-accent/20 bg-lr-accent-dim p-4">
          <p className="text-section-label">Final Annual Score</p>
          <p className="text-3xl font-bold text-lr-accent mt-1">{Number(existing.final_overall).toFixed(2)}</p>
        </div>
      )}

      {/* Override rationale */}
      <div className="space-y-1">
        <Label htmlFor="override_rationale" className="text-caption">Override rationale</Label>
        <p className="text-xs text-lr-muted mb-1">Required if you are overriding any suggested score.</p>
        <Textarea
          id="override_rationale"
          {...register('override_rationale')}
          disabled={isPending}
          placeholder="Explain why the suggested score is being adjusted…"
          className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[100px] resize-y"
        />
      </div>

      {error && (
        <div className="rounded-[var(--radius-lr)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-lr-accent hover:bg-lr-accent/90 text-white"
        >
          {isPending ? 'Finalizing…' : existing ? 'Update Annual Score' : 'Finalize Annual Score'}
        </Button>
        {saved && <span className="text-xs text-lr-cyan">Annual score finalized</span>}
      </div>
    </form>
  )
}
