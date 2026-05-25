'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { submitOnboarding } from '@/lib/actions/onboarding-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, ChevronDown, Plus, X } from 'lucide-react'

interface Manager {
  id: string
  email: string
  full_name: string | null
}

interface OnboardingFormProps {
  managers: Manager[]
  defaultFullName?: string | null
  defaultManagerId?: string | null
}

type Step = 1 | 2

const GOAL_SUGGESTIONS = [
  'Finish setting up my CiaoBob profile',
  'Explore CiaoBob',
]

function ManagerCombobox({
  managers,
  value,
  onChange,
}: {
  managers: Manager[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = value
    ? (() => {
        const m = managers.find((m) => m.id === value)
        return m ? { id: m.id, label: m.full_name ?? m.email } : null
      })()
    : null

  const filtered = managers.filter((m) => {
    const q = query.toLowerCase()
    return (
      (m.full_name ?? '').toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    )
  })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  function handleClear() {
    onChange('')
    setQuery('')
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center h-10 rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface px-3 gap-2 cursor-text"
        onClick={() => {
          setOpen(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
      >
        {selected ? (
          <>
            <span className="flex-1 text-sm text-lr-text truncate">{selected.label}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClear() }}
              className="text-lr-muted hover:text-lr-text flex-shrink-0"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              placeholder="Search your manager…"
              className="flex-1 bg-transparent text-sm text-lr-text placeholder:text-lr-muted outline-none min-w-0"
            />
            <ChevronDown className="h-4 w-4 text-lr-muted flex-shrink-0 pointer-events-none" />
          </>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-lr-muted">No results for "{query}"</p>
          )}
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSelect(m.id)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-lr-surface-raised transition-colors text-left"
            >
              <Check className={`h-3.5 w-3.5 flex-shrink-0 ${value === m.id ? 'opacity-100 text-lr-accent' : 'opacity-0'}`} />
              <span className="flex-1 truncate text-lr-text">{m.full_name ?? m.email}</span>
              <span className="text-xs text-lr-muted truncate max-w-[140px]">{m.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OnboardingForm({ managers, defaultFullName, defaultManagerId }: OnboardingFormProps) {
  const [step, setStep] = useState<Step>(1)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Step 1 state
  const [fullName, setFullName] = useState(defaultFullName ?? '')
  const [managerId, setManagerId] = useState(defaultManagerId ?? '')
  const [inviteMode, setInviteMode] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')

  // Step 2 state
  const [goals, setGoals] = useState<string[]>([''])

  // ── Step 1 handlers ──────────────────────────────────────────────
  function handleStep1Continue(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Name must be at least 2 characters')
      return
    }
    if (!inviteMode && !managerId) {
      setError('Please select your manager')
      return
    }
    if (inviteMode && !inviteEmail.trim()) {
      setError("Please enter your manager's email")
      return
    }
    setStep(2)
  }

  // ── Step 2 handlers ──────────────────────────────────────────────
  function addGoal() {
    if (goals.length < 5) setGoals([...goals, ''])
  }

  function removeGoal(idx: number) {
    if (goals.length === 1) return
    setGoals(goals.filter((_, i) => i !== idx))
  }

  function updateGoal(idx: number, value: string) {
    setGoals(goals.map((g, i) => (i === idx ? value : g)))
  }

  function applySuggestion(suggestion: string) {
    // Fill the first empty slot, or add a new one
    const emptyIdx = goals.findIndex((g) => g.trim() === '')
    if (emptyIdx >= 0) {
      updateGoal(emptyIdx, suggestion)
    } else if (goals.length < 5) {
      setGoals([...goals, suggestion])
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const validGoals = goals.map((g) => g.trim()).filter(Boolean)
    if (validGoals.length === 0) {
      setError('Add at least one goal')
      return
    }
    startTransition(async () => {
      const result = await submitOnboarding({
        fullName: fullName.trim(),
        managerId: inviteMode ? undefined : managerId,
        inviteManagerEmail: inviteMode ? inviteEmail.trim() : undefined,
        goals: validGoals.map((title) => ({ title })),
      })
      if ('error' in result) {
        setError(result.error)
      }
      // On success the page re-renders via revalidatePath → shows pending state
    })
  }

  // ── Render ────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <form onSubmit={handleStep1Continue} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-caption">Your full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
            required
            className="h-10 bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted"
          />
        </div>

        {!inviteMode ? (
          <div className="space-y-2">
            <Label className="text-caption">Your manager</Label>
            <ManagerCombobox managers={managers} value={managerId} onChange={setManagerId} />
            <button
              type="button"
              onClick={() => { setInviteMode(true); setManagerId('') }}
              className="text-xs text-lr-accent hover:underline"
            >
              My manager isn't listed — invite them by email
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="inviteEmail" className="text-caption">Manager's email</Label>
            <Input
              id="inviteEmail"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="manager@company.com"
              className="h-10 bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted"
            />
            <p className="text-xs text-lr-muted">
              We'll send them an email invitation. Once they sign in and approve, you'll get full access.
            </p>
            <button
              type="button"
              onClick={() => { setInviteMode(false); setInviteEmail('') }}
              className="text-xs text-lr-accent hover:underline"
            >
              Back to manager list
            </button>
          </div>
        )}

        {error && <p className="text-xs text-lr-error">{error}</p>}

        <Button
          type="submit"
          className="w-full bg-lr-accent hover:bg-lr-accent/90 text-white h-10"
        >
          Continue
        </Button>
      </form>
    )
  }

  // Step 2 — goals
  const usedSuggestions = new Set(goals.map((g) => g.trim()))

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-3">
        {goals.map((goal, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              value={goal}
              onChange={(e) => updateGoal(idx, e.target.value)}
              placeholder={`Goal ${idx + 1}…`}
              className="h-10 bg-lr-surface border-lr-border text-lr-text placeholder:text-lr-muted"
            />
            {goals.length > 1 && (
              <button
                type="button"
                onClick={() => removeGoal(idx)}
                className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-[var(--radius-lr)] text-lr-muted hover:text-lr-error hover:bg-lr-error-dim transition-colors"
                aria-label="Remove goal"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {goals.length < 5 && (
        <button
          type="button"
          onClick={addGoal}
          className="flex items-center gap-1.5 text-xs text-lr-accent hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another goal
        </button>
      )}

      {/* Suggestions */}
      <div className="space-y-2">
        <p className="text-xs text-lr-muted">Not sure what to add?</p>
        <div className="flex flex-wrap gap-2">
          {GOAL_SUGGESTIONS.filter((s) => !usedSuggestions.has(s)).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => applySuggestion(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-lr-border bg-lr-surface text-lr-muted hover:text-lr-text hover:border-lr-accent/40 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-lr-muted">
        You can add, edit, or remove goals at any time from your Goals page.
      </p>

      {error && <p className="text-xs text-lr-error">{error}</p>}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => { setStep(1); setError(null) }}
          className="flex-1 h-10 border-lr-border text-lr-muted hover:text-lr-text"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="flex-1 bg-lr-accent hover:bg-lr-accent/90 text-white h-10"
        >
          {isPending ? 'Submitting…' : 'Submit'}
        </Button>
      </div>
    </form>
  )
}
