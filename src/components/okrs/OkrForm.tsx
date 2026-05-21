'use client'

import { useTransition, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react'
import { createOkr, updateOkr } from '@/lib/actions/okr-actions'
import type { Okr, KeyResult, Initiative, PerformancePeriod } from '@/lib/types/database'

// ── Types ──────────────────────────────────────────────────────────────────
interface InitiativeState { _id: string; title: string }
interface KeyResultState  { _id: string; title: string; initiatives: InitiativeState[]; open: boolean }

function uid() { return Math.random().toString(36).slice(2) }

function blankKR(): KeyResultState {
  return { _id: uid(), title: '', open: true, initiatives: [{ _id: uid(), title: '' }] }
}

// ── Props ──────────────────────────────────────────────────────────────────
interface OkrFormProps {
  periods: PerformancePeriod[]
  defaultPeriodId?: string
  existing?: Okr & { key_results: (KeyResult & { initiatives: Initiative[] })[] }
}

export default function OkrForm({ periods, defaultPeriodId, existing }: OkrFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const openPeriods = periods.filter(p => p.status === 'open')

  const [periodId, setPeriodId] = useState(
    existing?.period_id ?? defaultPeriodId ?? openPeriods[0]?.id ?? ''
  )
  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [keyResults, setKeyResults] = useState<KeyResultState[]>(() => {
    if (existing?.key_results?.length) {
      return existing.key_results.map(kr => ({
        _id: kr.id,
        title: kr.title,
        open: true,
        initiatives: kr.initiatives.map(i => ({ _id: i.id, title: i.title })),
      }))
    }
    return [blankKR()]
  })

  // ── KR helpers ─────────────────────────────────────────────────────────
  function addKR() {
    setKeyResults(prev => [...prev, blankKR()])
  }
  function removeKR(krId: string) {
    setKeyResults(prev => prev.filter(kr => kr._id !== krId))
  }
  function updateKR(krId: string, patch: Partial<KeyResultState>) {
    setKeyResults(prev => prev.map(kr => kr._id === krId ? { ...kr, ...patch } : kr))
  }
  function addInitiative(krId: string) {
    setKeyResults(prev => prev.map(kr =>
      kr._id === krId
        ? { ...kr, initiatives: [...kr.initiatives, { _id: uid(), title: '' }] }
        : kr
    ))
  }
  function removeInitiative(krId: string, initId: string) {
    setKeyResults(prev => prev.map(kr =>
      kr._id === krId
        ? { ...kr, initiatives: kr.initiatives.filter(i => i._id !== initId) }
        : kr
    ))
  }
  function updateInitiative(krId: string, initId: string, title: string) {
    setKeyResults(prev => prev.map(kr =>
      kr._id === krId
        ? { ...kr, initiatives: kr.initiatives.map(i => i._id === initId ? { ...i, title } : i) }
        : kr
    ))
  }

  // ── Validation ─────────────────────────────────────────────────────────
  function validate() {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Objective title is required'
    if (keyResults.length === 0) errs.keyResults = 'Add at least one key result'
    keyResults.forEach((kr, ki) => {
      if (!kr.title.trim()) errs[`kr_${ki}`] = `KR ${ki + 1}: key result title is required`
      if (kr.initiatives.length === 0) errs[`kr_${ki}_inits`] = `KR ${ki + 1}: add at least one initiative`
      kr.initiatives.forEach((init, ii) => {
        if (!init.title.trim()) errs[`kr_${ki}_init_${ii}`] = `KR ${ki + 1}, initiative ${ii + 1}: title is required`
      })
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const scrollToField = useCallback((fieldId: string) => {
    const el = document.getElementById(fieldId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  // ── Submit ─────────────────────────────────────────────────────────────
  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setServerError(null)

    const payload = {
      periodId,
      title: title.trim(),
      description: description.trim() || undefined,
      keyResults: keyResults.map(kr => ({
        title: kr.title.trim(),
        initiatives: kr.initiatives.map(i => ({ title: i.title.trim() })),
      })),
    }

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
        router.push(result.id ? `/okrs/${result.id}` : '/okrs')
      }
    })
  }

  const errorEntries = Object.entries(errors)

  // Map error keys to scrollable field IDs
  function fieldIdForKey(key: string): string {
    if (key === 'title') return 'okr-title'
    if (key === 'keyResults') return 'okr-kr-list'
    const krMatch = key.match(/^kr_(\d+)$/)
    if (krMatch) return `okr-kr-${krMatch[1]}-title`
    const initMatch = key.match(/^kr_(\d+)_init_(\d+)$/)
    if (initMatch) return `okr-kr-${initMatch[1]}-init-${initMatch[2]}`
    return ''
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">

      {/* Error summary banner */}
      {errorEntries.length > 0 && (
        <div className="rounded-[var(--radius-lr-lg)] border border-red-500/30 bg-red-500/10 px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">
              {errorEntries.length} field{errorEntries.length !== 1 ? 's' : ''} need{errorEntries.length === 1 ? 's' : ''} attention
            </p>
          </div>
          <ul className="space-y-0.5 pl-6">
            {errorEntries.map(([key, msg]) => {
              const fieldId = fieldIdForKey(key)
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => fieldId && scrollToField(fieldId)}
                    className="text-xs text-red-400 hover:text-red-300 hover:underline text-left"
                  >
                    {msg}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Period selector */}
      {!existing && (
        <div className="space-y-1.5">
          <label className="text-section-label">Performance Period</label>
          <Select value={periodId} onValueChange={setPeriodId}>
            <SelectTrigger className="bg-lr-surface border-lr-border text-lr-text">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent className="bg-white border-lr-border">
              {openPeriods.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Objective */}
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass p-5 space-y-4">
        <p className="text-kicker">Objective</p>
        <div className="space-y-1.5">
          <Input
            id="okr-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Improve customer onboarding experience"
            className="bg-white border-lr-border text-lr-text placeholder:text-lr-muted font-medium"
          />
          {errors.title && <p className="text-xs text-red-500">{errors.title}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-section-label">Description <span className="text-lr-muted">(optional)</span></label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What does success look like for this objective?"
            rows={2}
            className="bg-white border-lr-border text-lr-text placeholder:text-lr-muted resize-none"
          />
        </div>
      </div>

      {/* Key Results */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-section-label">Key Results</p>
          <Button
            type="button" variant="outline" size="sm"
            onClick={addKR}
            className="border-lr-accent/40 text-lr-accent hover:bg-lr-accent-dim gap-1.5 text-xs h-7"
          >
            <Plus className="h-3 w-3" /> Add Key Result
          </Button>
        </div>
        {errors.keyResults && <p className="text-xs text-red-500">{errors.keyResults}</p>}

        <div className="space-y-3" id="okr-kr-list">
          {keyResults.map((kr, ki) => (
            <div
              key={kr._id}
              className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-surface overflow-hidden"
            >
              {/* KR header */}
              <div className="flex items-start gap-2 p-4">
                <button
                  type="button"
                  onClick={() => updateKR(kr._id, { open: !kr.open })}
                  className="mt-2.5 text-lr-muted hover:text-lr-text shrink-0"
                >
                  {kr.open
                    ? <ChevronDown className="h-4 w-4" />
                    : <ChevronRight className="h-4 w-4" />}
                </button>
                <div className="flex-1 space-y-1">
                  <label className="text-section-label">KR {ki + 1}</label>
                  <Input
                    id={`okr-kr-${ki}-title`}
                    value={kr.title}
                    onChange={e => updateKR(kr._id, { title: e.target.value })}
                    placeholder="e.g. Reduce time-to-first-value to under 5 minutes"
                    className="bg-white border-lr-border text-lr-text placeholder:text-lr-muted"
                  />
                  {errors[`kr_${ki}`] && <p className="text-xs text-red-500">{errors[`kr_${ki}`]}</p>}
                </div>
                {keyResults.length > 1 && (
                  <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => removeKR(kr._id)}
                    className="text-lr-muted hover:text-red-500 h-8 w-8 p-0 shrink-0 mt-5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Initiatives (collapsible) */}
              {kr.open && (
                <div className="border-t border-lr-border px-4 pb-4 pt-3 space-y-2 bg-lr-glass/50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-section-label text-lr-muted">Initiatives</p>
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => addInitiative(kr._id)}
                      className="text-lr-muted hover:text-lr-accent gap-1 text-xs h-6 px-2"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </div>
                  {errors[`kr_${ki}_inits`] && (
                    <p className="text-xs text-red-500">{errors[`kr_${ki}_inits`]}</p>
                  )}
                  {kr.initiatives.map((init, ii) => (
                    <div key={init._id} className="flex items-center gap-2">
                      <span className="text-section-label w-4 shrink-0 text-center">{ii + 1}</span>
                      <Input
                        id={`okr-kr-${ki}-init-${ii}`}
                        value={init.title}
                        onChange={e => updateInitiative(kr._id, init._id, e.target.value)}
                        placeholder="Specific action or task…"
                        className="flex-1 h-8 text-sm bg-white border-lr-border text-lr-text placeholder:text-lr-muted"
                      />
                      {kr.initiatives.length > 1 && (
                        <Button
                          type="button" variant="ghost" size="sm"
                          onClick={() => removeInitiative(kr._id, init._id)}
                          className="h-8 w-8 p-0 text-lr-muted hover:text-red-500 shrink-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                      {errors[`kr_${ki}_init_${ii}`] && (
                        <p className="text-xs text-red-500">{errors[`kr_${ki}_init_${ii}`]}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {serverError && (
        <div className="rounded-[var(--radius-lr)] bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-600">{serverError}</p>
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
