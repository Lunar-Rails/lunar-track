'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import type { PlanMit } from '@/lib/types/database'

export interface LinkOption {
  id: string
  label: string
}

interface MitPlanListProps {
  value: PlanMit[]
  onChange: (mits: PlanMit[]) => void
  linkOptions: LinkOption[]
  linkLabel?: string
  noLinkLabel?: string
  disabled?: boolean
}

const UNRELATED = '__unrelated__'

function emptyPlanMit(): PlanMit {
  return { title: '', description: '', okr_id: null, okr_label: null }
}

export default function MitPlanList({
  value, onChange, linkOptions,
  linkLabel = 'Quarterly OKR',
  noLinkLabel = 'Unrelated to quarterly OKRs',
  disabled = false,
}: MitPlanListProps) {
  function add() { onChange([...value, emptyPlanMit()]) }
  function remove(index: number) { onChange(value.filter((_, i) => i !== index)) }
  function update(index: number, patch: Partial<PlanMit>) {
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
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <Label className="text-caption">Title</Label>
                <Input value={mit.title} onChange={(e) => update(index, { title: e.target.value })} disabled={disabled} placeholder="What is this MIT?" className="bg-lr-surface border-lr-border text-lr-text text-sm h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-caption">What / description</Label>
                <Textarea value={mit.description} onChange={(e) => update(index, { description: e.target.value })} disabled={disabled} placeholder="Describe the scope or success criteria…" className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[72px] resize-y" />
              </div>
              <div className="space-y-1">
                <Label className="text-caption">{linkLabel}</Label>
                <Select value={mit.okr_id ?? UNRELATED} onValueChange={(v) => handleLinkChange(index, v)} disabled={disabled}>
                  <SelectTrigger className="bg-lr-surface border-lr-border text-lr-text text-sm h-9">
                    <SelectValue placeholder={`Link to ${linkLabel}…`} />
                  </SelectTrigger>
                  <SelectContent
                    side="bottom"
                    position="popper"
                    sideOffset={4}
                    className="bg-[#13111f] border border-white/10 shadow-2xl backdrop-blur-none"
                  >
                    {linkOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                    ))}
                    <SelectItem value={UNRELATED}><span className="text-lr-muted italic">{noLinkLabel}</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!disabled && value.length > 1 && (
              <button type="button" onClick={() => remove(index)} className="mt-1 text-lr-muted hover:text-lr-error transition-colors flex-shrink-0" aria-label="Remove MIT">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
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
