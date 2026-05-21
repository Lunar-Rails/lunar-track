'use client'

import { useTransition, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createPeriod } from '@/lib/actions/period-actions'

export default function CreatePeriodForm() {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const currentYear = new Date().getFullYear()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setFeedback(null)
    startTransition(async () => {
      const result = await createPeriod(formData)
      if ('error' in result) {
        setFeedback({ type: 'error', message: result.error })
      } else {
        setFeedback({ type: 'success', message: 'Period created successfully' })
        formRef.current?.reset()
        setTimeout(() => setFeedback(null), 3000)
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-section-label block mb-1">Period Name</label>
          <Input
            name="name"
            placeholder={`Q1 ${currentYear}`}
            required
            className="bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted"
          />
        </div>
        <div>
          <label className="text-section-label block mb-1">Year</label>
          <Input
            name="year"
            type="number"
            defaultValue={currentYear}
            min={2020}
            max={2099}
            required
            className="bg-lr-surface border-lr-border text-lr-text"
          />
        </div>
        <div>
          <label className="text-section-label block mb-1">Quarter</label>
          <Input
            name="quarter"
            type="number"
            min={1}
            max={4}
            placeholder="1"
            required
            className="bg-lr-surface border-lr-border text-lr-text"
          />
        </div>
        <div>
          <label className="text-section-label block mb-1">Start Date</label>
          <Input
            name="startDate"
            type="date"
            required
            className="bg-lr-surface border-lr-border text-lr-text"
          />
        </div>
        <div>
          <label className="text-section-label block mb-1">End Date</label>
          <Input
            name="endDate"
            type="date"
            required
            className="bg-lr-surface border-lr-border text-lr-text"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="bg-lr-accent hover:bg-lr-accent-hover text-white"
      >
        {isPending ? 'Creating…' : 'Create Period'}
      </Button>

      {feedback && (
        <p className={`text-sm ${feedback.type === 'error' ? 'text-lr-error' : 'text-lr-success'}`}>
          {feedback.message}
        </p>
      )}
    </form>
  )
}
