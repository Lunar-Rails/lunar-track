'use client'

import { useTransition, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createOkr, updateOkr } from '@/lib/actions/okr-actions'
import type { Okr, PerformancePeriod } from '@/lib/types/database'

interface OkrFormProps {
  periods: PerformancePeriod[]
  defaultPeriodId?: string
  existing?: Pick<Okr, 'id' | 'period_id' | 'title' | 'description'>
  // 'navigate' (default) opens the new goal after create; 'stay' keeps the user on
  // the page (form resets, new goal appears in the list above) — used on /okrs/new.
  afterCreate?: 'navigate' | 'stay'
}

export default function OkrForm({ periods, defaultPeriodId, existing, afterCreate = 'navigate' }: OkrFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const openPeriod = periods.find(p => p.status === 'open')
  const periodId = existing?.period_id ?? defaultPeriodId ?? openPeriod?.id ?? ''

  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')

  function save() {
    setTitleError(null)
    setServerError(null)
    if (!title.trim()) { setTitleError('Goal title is required'); return }

    const goalTitle = title.trim()
    const payload = { periodId, title: goalTitle, description: description.trim() || undefined }

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
        return
      }
      if (existing) {
        // Editing an existing goal → return to its (read-only) detail view.
        router.push(`/okrs/${existing.id}`)
      } else if (afterCreate === 'stay') {
        // Stay on the page; the new goal appears in the list above and the form resets.
        setTitle('')
        setDescription('')
        setSavedNotice(`“${goalTitle}” added to your goals.`)
        router.refresh()
        titleRef.current?.focus()
      } else {
        router.push('success' in result && result.id ? `/okrs/${result.id}` : '/okrs')
      }
    })
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    save()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-section-label">Goal</label>
          <Input
            ref={titleRef}
            value={title}
            onChange={e => { setTitle(e.target.value); if (savedNotice) setSavedNotice(null) }}
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

      {savedNotice && (
        <div className="rounded-[var(--radius-lr)] bg-lr-success/10 border border-lr-success/20 px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-lr-success shrink-0" />
          <p className="text-sm text-lr-success">{savedNotice}</p>
        </div>
      )}

      {serverError && (
        <div className="rounded-[var(--radius-lr)] bg-lr-error-dim border border-lr-error/20 px-4 py-3">
          <p className="text-sm text-lr-error">{serverError}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isPending} className="bg-lr-accent hover:bg-lr-accent-hover text-white">
          {isPending ? 'Saving…' : existing ? 'Save Changes' : 'Create Goal'}
        </Button>
        <Button type="button" variant="outline" onClick={() => existing ? router.push(`/okrs/${existing.id}`) : router.back()}
          className="border-lr-border text-lr-muted hover:text-lr-text">
          Cancel
        </Button>
      </div>
    </form>
  )
}
