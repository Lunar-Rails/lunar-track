'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createOkr, updateOkr } from '@/lib/actions/okr-actions'
import type { Okr, PerformancePeriod } from '@/lib/types/database'

interface OkrFormProps {
  periods: PerformancePeriod[]
  defaultPeriodId?: string
  existing?: Pick<Okr, 'id' | 'period_id' | 'title' | 'description'>
}

export default function OkrForm({ periods, defaultPeriodId, existing }: OkrFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)

  const openPeriod = periods.find(p => p.status === 'open')
  const periodId = existing?.period_id ?? defaultPeriodId ?? openPeriod?.id ?? ''

  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTitleError(null)
    setServerError(null)
    if (!title.trim()) { setTitleError('Goal title is required'); return }

    const payload = { periodId, title: title.trim(), description: description.trim() || undefined }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('payload', JSON.stringify(payload))
      let result
      if (existing) {
        formData.set('okrId', existing.id)
        result = await updateOkr(formData)
      } else {
        result = await createOkr(formData)
      }
      if ('error' in result) {
        setServerError(result.error)
      } else {
        router.push('success' in result && result.id ? `/okrs/${result.id}` : '/okrs')
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-section-label">Goal</label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What do you want to achieve this quarter?"
            className="bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted font-medium"
          />
          {titleError && <p className="text-xs text-lr-error">{titleError}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-section-label">Description <span className="text-lr-muted">(optional)</span></label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief description or success criteria..."
            rows={3}
            className="bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted resize-none"
          />
        </div>
      </div>

      {serverError && (
        <div className="rounded-[var(--radius-lr)] bg-lr-error-dim border border-lr-error/20 px-4 py-3">
          <p className="text-sm text-lr-error">{serverError}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending} className="bg-lr-accent hover:bg-lr-accent-hover text-white">
          {isPending ? 'Saving…' : existing ? 'Save Changes' : 'Create Goal'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}
          className="border-lr-border text-lr-muted hover:text-lr-text">
          Cancel
        </Button>
      </div>
    </form>
  )
}
