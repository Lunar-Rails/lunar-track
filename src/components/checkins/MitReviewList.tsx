'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import type { ReviewMit } from '@/lib/types/database'

interface MitReviewListProps {
  value: ReviewMit[]
  onChange: (mits: ReviewMit[]) => void
  disabled?: boolean
}

function emptyReviewMit(): ReviewMit {
  return { title: '', description: '', okr_id: null, okr_label: null, status: 'not_achieved' }
}

export default function MitReviewList({ value, onChange, disabled = false }: MitReviewListProps) {
  function add() {
    onChange([...value, emptyReviewMit()])
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function update(index: number, patch: Partial<ReviewMit>) {
    onChange(value.map((m, i) => i === index ? { ...m, ...patch } : m))
  }

  function toggleStatus(index: number) {
    const next = value[index].status === 'achieved' ? 'not_achieved' : 'achieved'
    update(index, { status: next })
  }

  return (
    <div className="space-y-3">
      {value.map((mit, index) => (
        <div key={index} className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <Label className="text-caption">Title</Label>
                <Input
                  value={mit.title}
                  onChange={(e) => update(index, { title: e.target.value })}
                  disabled={disabled}
                  placeholder="What was this MIT?"
                  className="bg-lr-surface border-lr-border text-lr-text text-sm h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-caption">What / description</Label>
                <Textarea
                  value={mit.description}
                  onChange={(e) => update(index, { description: e.target.value })}
                  disabled={disabled}
                  placeholder="Describe the scope or success criteria…"
                  className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[72px] resize-y"
                />
              </div>
              {mit.okr_id ? (
                <p className="text-xs text-lr-accent">OKR: {mit.okr_label ?? mit.okr_id}</p>
              ) : (
                <p className="text-xs text-lr-muted italic">Unrelated to quarterly OKRs</p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {!disabled && value.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="text-lr-muted hover:text-lr-error transition-colors" aria-label="Remove MIT">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => !disabled && toggleStatus(index)}
                disabled={disabled}
                className="flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50"
              >
                {mit.status === 'achieved' ? (
                  <><CheckCircle2 className="h-4 w-4 text-green-400" /><span className="text-green-400">Achieved</span></>
                ) : (
                  <><XCircle className="h-4 w-4 text-red-400" /><span className="text-red-400">Not achieved</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      ))}
      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={add} className="w-full gap-1.5 border-lr-accent text-lr-accent hover:bg-lr-accent-dim text-xs">
          <Plus className="h-3.5 w-3.5" /> Add MIT
        </Button>
      )}
    </div>
  )
}
