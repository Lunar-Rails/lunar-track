'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import type { ReviewMit } from '@/lib/types/database'
import type { LinkOption } from '@/components/checkins/MitPlanList'

interface MitReviewListProps {
  value: ReviewMit[]
  onChange: (mits: ReviewMit[]) => void
  linkOptions?: LinkOption[]
  disabled?: boolean
}

const UNRELATED = '__unrelated__'

function emptyReviewMit(): ReviewMit {
  return { title: '', description: '', okr_id: null, okr_label: null, status: 'not_achieved' }
}

export default function MitReviewList({ value, onChange, linkOptions = [], disabled = false }: MitReviewListProps) {
  function add() {
    onChange([...value, emptyReviewMit()])
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function update(index: number, patch: Partial<ReviewMit>) {
    onChange(value.map((m, i) => i === index ? { ...m, ...patch } : m))
  }

  function handleLinkChange(index: number, selectedId: string) {
    if (selectedId === UNRELATED) {
      update(index, { okr_id: null, okr_label: null })
    } else {
      const option = linkOptions.find((o) => o.id === selectedId)
      update(index, { okr_id: selectedId, okr_label: option?.label ?? null })
    }
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
                  maxLength={300}
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
                  maxLength={4000}
                  placeholder="Describe the scope or success criteria…"
                  className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[72px] resize-y"
                />
                <div className="flex justify-end"><span className="text-[10px] text-lr-muted">{mit.description.length}/4000</span></div>
              </div>
              {/* Goal selector — shown when there are options; read-only fallback when disabled */}
              {!disabled && linkOptions.length > 0 ? (
                <div className="space-y-1">
                  <Label className="text-caption">Quarterly goal</Label>
                  <Select
                    value={mit.okr_id ?? UNRELATED}
                    onValueChange={(v) => handleLinkChange(index, v)}
                  >
                    <SelectTrigger className="bg-lr-surface border-lr-border text-lr-text text-sm h-9">
                      <SelectValue placeholder="Link to goal…" />
                    </SelectTrigger>
                    <SelectContent
                      side="bottom"
                      position="popper"
                      avoidCollisions={false}
                      sideOffset={4}
                      className="bg-lr-bg border border-lr-border shadow-[var(--shadow-lr-dropdown)] backdrop-blur-none min-w-[var(--radix-select-trigger-width)]"
                    >
                      {linkOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id} className="text-lr-text text-sm py-2.5 pl-3 pr-8 cursor-pointer">
                          {opt.label}
                        </SelectItem>
                      ))}
                      <SelectItem value={UNRELATED} className="text-sm py-2.5 pl-3 pr-8 cursor-pointer">
                        <span className="text-lr-muted italic">Unrelated to quarterly goals</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : !disabled && linkOptions.length === 0 ? (
                <p className="text-xs text-lr-muted italic">No quarterly goals added yet — add them in the Dashboard.</p>
              ) : (
                mit.okr_id ? (
                  <p className="text-xs text-lr-accent">Goal: {mit.okr_label ?? mit.okr_id}</p>
                ) : (
                  <p className="text-xs text-lr-muted italic">Unrelated to quarterly goals</p>
                )
              )}
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {!disabled && value.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="text-lr-muted hover:text-lr-error transition-colors" aria-label="Remove MIT">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => !disabled && update(index, { status: 'achieved' })}
                  disabled={disabled}
                  className={[
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
                    mit.status === 'achieved'
                      ? 'border-lr-success/60 bg-lr-success/15 text-lr-success'
                      : 'border-transparent bg-transparent text-lr-muted/40 hover:text-lr-muted',
                    disabled ? 'cursor-default' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Achieved
                </button>
                <button
                  type="button"
                  onClick={() => !disabled && update(index, { status: 'not_achieved' })}
                  disabled={disabled}
                  className={[
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
                    mit.status === 'not_achieved'
                      ? 'border-lr-error/60 bg-lr-error/15 text-lr-error'
                      : 'border-transparent bg-transparent text-lr-muted/40 hover:text-lr-muted',
                    disabled ? 'cursor-default' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <XCircle className="h-3.5 w-3.5" /> Not achieved
                </button>
              </div>
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
