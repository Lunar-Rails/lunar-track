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
import { upsertCheckinEmployee } from '@/lib/actions/checkin-actions'
import type { Checkin, Mit } from '@/lib/types/database'

const schema = z.object({
  done_well: z.string().max(3000).optional(),
  do_differently: z.string().max(3000).optional(),
  support_requests: z.string().max(3000).optional(),
  ai_builder: z.string().max(3000).optional(),
})

type FormValues = z.infer<typeof schema>

interface EmployeeCheckinFormProps {
  periodId: string
  month: number
  year: number
  checkin: Checkin | null
  readOnly?: boolean
}

function initMits(checkin: Checkin | null): Mit[] {
  if (!checkin) return [{ title: '', description: '' }]
  if (checkin.mits && checkin.mits.length > 0) return checkin.mits
  // Build from legacy fixed fields
  const result: Mit[] = []
  if (checkin.mit_1_title) result.push({ title: checkin.mit_1_title, description: checkin.mit_1_description ?? '' })
  if (checkin.mit_2_title) result.push({ title: checkin.mit_2_title, description: checkin.mit_2_description ?? '' })
  if (checkin.mit_3_title) result.push({ title: checkin.mit_3_title, description: checkin.mit_3_description ?? '' })
  return result.length > 0 ? result : [{ title: '', description: '' }]
}

export default function EmployeeCheckinForm({
  periodId,
  month,
  year,
  checkin,
  readOnly = false,
}: EmployeeCheckinFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [mits, setMits] = useState<Mit[]>(() => initMits(checkin))

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      done_well: checkin?.done_well ?? '',
      do_differently: checkin?.do_differently ?? '',
      support_requests: checkin?.support_requests ?? '',
      ai_builder: checkin?.ai_builder ?? '',
    },
  })

  function addMit() {
    setMits((prev) => [...prev, { title: '', description: '' }])
  }

  function removeMit(index: number) {
    setMits((prev) => prev.filter((_, i) => i !== index))
  }

  function updateMit(index: number, field: keyof Mit, value: string) {
    setMits((prev) => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }

  function buildFormData(values: FormValues, submit: boolean): FormData {
    const fd = new FormData()
    fd.append('periodId', periodId)
    fd.append('month', String(month))
    fd.append('year', String(year))
    fd.append('mits', JSON.stringify(mits.filter((m) => m.title.trim())))
    if (submit) fd.append('submit', 'true')
    Object.entries(values).forEach(([k, v]) => {
      if (v) fd.append(k, v)
    })
    return fd
  }

  function onSave(values: FormValues) {
    setError(null)
    startTransition(async () => {
      const result = await upsertCheckinEmployee(buildFormData(values, false))
      if ('error' in result) {
        setError(result.error)
      } else {
        setSavedAt(new Date())
        if (result.id) router.replace(`/checkins/${result.id}`)
      }
    })
  }

  function onSubmit(values: FormValues) {
    setError(null)
    startTransition(async () => {
      const result = await upsertCheckinEmployee(buildFormData(values, true))
      if ('error' in result) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-8">
      {readOnly && (
        <div className="rounded-[var(--radius-lr)] border border-lr-accent/20 bg-lr-accent-dim px-4 py-3 text-sm text-lr-accent">
          You submitted this check-in. Editing is locked.
        </div>
      )}

      <form onSubmit={handleSubmit(onSave)} className="space-y-8">
        {/* MITs */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-card-title">Most Important Things (MITs)</h3>
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMit}
                className="gap-1.5 border-lr-accent text-lr-accent hover:bg-lr-accent-dim text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Add MIT
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {mits.map((mit, index) => (
              <div key={index} className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-section-label">MIT {index + 1}{index === 0 ? ' *' : ''}</p>
                  {!readOnly && mits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMit(index)}
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
                    onChange={(e) => updateMit(index, 'title', e.target.value)}
                    disabled={readOnly || isPending}
                    placeholder={`What is MIT ${index + 1}?`}
                    className="bg-lr-surface border-lr-border text-lr-text text-sm h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-caption">Description</Label>
                  <Textarea
                    value={mit.description}
                    onChange={(e) => updateMit(index, 'description', e.target.value)}
                    disabled={readOnly || isPending}
                    placeholder="Add context or success criteria…"
                    className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[80px] resize-y"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Reflections */}
        <section className="space-y-5">
          <h3 className="text-card-title">Reflections</h3>
          {[
            { name: 'done_well', label: 'What went well?', placeholder: 'Share your wins and successes…' },
            { name: 'do_differently', label: 'What would you do differently?', placeholder: 'Areas for growth or change…' },
            { name: 'support_requests', label: 'Support requests', placeholder: 'What do you need from your manager or the team?' },
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
        </section>

        {/* AI Builder */}
        <section className="space-y-1">
          <Label htmlFor="ai_builder" className="text-caption">
            AI Builder <span className="text-lr-accent">*</span>
          </Label>
          <p className="text-xs text-lr-muted mb-2">
            Describe an AI tool or project you are building or using. Required before submitting.
          </p>
          <Textarea
            id="ai_builder"
            {...register('ai_builder')}
            disabled={readOnly || isPending}
            placeholder="What AI tools or projects are you working on?"
            className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[100px] resize-y"
          />
          {errors.ai_builder && <p className="text-xs text-red-400">{errors.ai_builder.message}</p>}
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
              {isPending ? 'Submitting…' : 'Submit Check-in'}
            </Button>
            {savedAt && (
              <span className="text-xs text-lr-muted">
                Saved {savedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
        )}
      </form>
    </div>
  )
}
