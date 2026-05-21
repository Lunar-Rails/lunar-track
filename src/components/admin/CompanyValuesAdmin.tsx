'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { upsertCompanyValue, deleteCompanyValue } from '@/lib/actions/admin-actions'
import type { CompanyValue } from '@/lib/types/database'

interface CompanyValuesAdminProps {
  initialValues: CompanyValue[]
}

interface EditState {
  id?: string
  name: string
  description: string
  sort_order: number
}

function blankEdit(sortOrder: number): EditState {
  return { name: '', description: '', sort_order: sortOrder }
}

export default function CompanyValuesAdmin({ initialValues }: CompanyValuesAdminProps) {
  const [values, setValues] = useState<CompanyValue[]>(initialValues)
  const [editing, setEditing] = useState<EditState | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function startAdd() {
    setEditing(blankEdit(values.length + 1))
    setError(null)
  }

  function startEdit(v: CompanyValue) {
    setEditing({ id: v.id, name: v.name, description: v.description, sort_order: v.sort_order })
    setError(null)
  }

  function cancelEdit() {
    setEditing(null)
    setError(null)
  }

  function save() {
    if (!editing) return
    if (!editing.name.trim()) { setError('Name is required'); return }
    setError(null)
    const fd = new FormData()
    if (editing.id) fd.append('id', editing.id)
    fd.append('name', editing.name.trim())
    fd.append('description', editing.description.trim())
    fd.append('sort_order', String(editing.sort_order))

    startTransition(async () => {
      const result = await upsertCompanyValue(fd)
      if ('error' in result) { setError(result.error); return }
      if (result.value) {
        setValues((prev) => {
          const idx = prev.findIndex((v) => v.id === result.value!.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = result.value!
            return next
          }
          return [...prev, result.value!]
        })
      }
      setEditing(null)
    })
  }

  function remove(valueId: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeletingId(valueId)
    startTransition(async () => {
      const result = await deleteCompanyValue(valueId)
      setDeletingId(null)
      if ('error' in result) { setError(result.error); return }
      setValues((prev) => prev.filter((v) => v.id !== valueId))
    })
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-[var(--radius-lr)] border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border overflow-hidden">
        {values.length === 0 && !editing && (
          <div className="p-8 text-center text-lr-muted text-sm">No values yet.</div>
        )}

        {values.map((v, i) => (
          <div
            key={v.id}
            className={`flex items-start gap-4 px-5 py-4 ${
              i < values.length - 1 ? 'border-b border-lr-border' : ''
            } bg-lr-glass`}
          >
            {editing?.id === v.id ? (
              <div className="flex-1 space-y-3">
                <div className="space-y-1">
                  <Label className="text-caption">Name</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    disabled={isPending}
                    placeholder="Value name"
                    className="bg-lr-surface border-lr-border text-lr-text text-sm h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-caption">Description</Label>
                  <Textarea
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    disabled={isPending}
                    placeholder="What does this value mean in practice?"
                    className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[72px] resize-y"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={save}
                    disabled={isPending}
                    className="bg-lr-accent hover:bg-lr-accent/90 text-white gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" /> Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={cancelEdit}
                    disabled={isPending}
                    className="border-lr-border text-lr-muted"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-lr-muted shrink-0 w-5">{v.sort_order}</span>
                    <p className="text-sm font-semibold text-lr-text">{v.name}</p>
                  </div>
                  {v.description && (
                    <p className="text-xs text-lr-muted mt-0.5 ml-7">{v.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(v)}
                    disabled={isPending || !!editing}
                    className="p-1.5 rounded text-lr-muted hover:text-lr-text hover:bg-lr-surface transition-colors disabled:opacity-40"
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(v.id, v.name)}
                    disabled={isPending || deletingId === v.id || !!editing}
                    className="p-1.5 rounded text-lr-muted hover:text-red-400 transition-colors disabled:opacity-40"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {/* Inline add form */}
        {editing && !editing.id && (
          <div className={`px-5 py-4 bg-lr-glass ${values.length > 0 ? 'border-t border-lr-border' : ''}`}>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-lr-accent">New value</p>
              <div className="space-y-1">
                <Label className="text-caption">Name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  disabled={isPending}
                  placeholder="e.g. Ship great things"
                  autoFocus
                  className="bg-lr-surface border-lr-border text-lr-text text-sm h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-caption">Description</Label>
                <Textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  disabled={isPending}
                  placeholder="What does this value mean in practice?"
                  className="bg-lr-surface border-lr-border text-lr-text text-sm min-h-[72px] resize-y"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={save}
                  disabled={isPending}
                  className="bg-lr-accent hover:bg-lr-accent/90 text-white gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" /> Add value
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={cancelEdit}
                  disabled={isPending}
                  className="border-lr-border text-lr-muted"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!editing && (
        <Button
          type="button"
          variant="outline"
          onClick={startAdd}
          className="gap-2 border-lr-accent text-lr-accent hover:bg-lr-accent-dim"
        >
          <Plus className="h-4 w-4" /> Add value
        </Button>
      )}
    </div>
  )
}
