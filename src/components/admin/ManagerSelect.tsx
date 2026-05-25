'use client'

import { useTransition, useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { assignManager } from '@/lib/actions/user-actions'
import type { Profile } from '@/lib/types/database'

interface ManagerSelectProps {
  employeeId: string
  currentManagerId: string | null
  allUsers: Pick<Profile, 'id' | 'full_name' | 'email'>[]
}

export default function ManagerSelect({ employeeId, currentManagerId, allUsers }: ManagerSelectProps) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [value, setValue] = useState(currentManagerId ?? '')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const options = allUsers
    .filter((u) => u.id !== employeeId)
    .sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email))

  const selected = value ? (options.find((u) => u.id === value) ?? null) : null

  const filtered = options.filter((u) => {
    const q = query.toLowerCase()
    return (
      (u.full_name ?? '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    )
  })

  // Group by email domain
  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, u) => {
    const domain = u.email.split('@')[1] ?? 'Other'
    if (!acc[domain]) acc[domain] = []
    acc[domain].push(u)
    return acc
  }, {})
  const domains = Object.keys(grouped).sort()
  const isGrouped = domains.length > 1 && !query

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

  function commit(newManagerId: string) {
    setValue(newManagerId)
    setOpen(false)
    setQuery('')
    setFeedback(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('employeeId', employeeId)
      formData.set('newManagerId', newManagerId)
      const result = await assignManager(formData)
      if ('error' in result) {
        setFeedback({ type: 'error', message: result.error })
      } else {
        setFeedback({ type: 'success', message: 'Saved' })
        setTimeout(() => setFeedback(null), 2000)
      }
    })
  }

  function openDropdown() {
    if (isPending) return
    setOpen(true)
    setTimeout(() => (selected ? searchRef.current : inputRef.current)?.focus(), 0)
  }

  return (
    <div className="space-y-1">
      <div ref={containerRef} className="relative">
        {/* Trigger */}
        <div
          onClick={openDropdown}
          className={`flex items-center h-8 w-48 rounded-md border border-lr-border bg-lr-surface px-2 gap-1.5 cursor-text ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {selected ? (
            <>
              <span className="flex-1 text-xs text-lr-text truncate">
                {selected.full_name ?? selected.email}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); commit('') }}
                className="text-lr-muted hover:text-lr-text flex-shrink-0"
                aria-label="Clear"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
                onFocus={() => setOpen(true)}
                placeholder="No manager"
                disabled={isPending}
                className="flex-1 bg-transparent text-xs text-lr-muted placeholder:text-lr-muted outline-none min-w-0"
              />
              <ChevronDown className="h-3 w-3 text-lr-muted flex-shrink-0 pointer-events-none" />
            </>
          )}
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 mt-1 w-56 rounded-md border border-lr-border bg-lr-surface shadow-lg">
            {/* Search box (shown when a manager is already selected) */}
            {selected && (
              <div className="p-1.5 border-b border-lr-border">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full bg-lr-surface-2 rounded px-2 py-1 text-xs text-lr-text placeholder:text-lr-muted outline-none border border-lr-border"
                />
              </div>
            )}
            <div className="max-h-48 overflow-y-auto">
              {/* No manager option */}
              <button
                type="button"
                onClick={() => commit('')}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-lr-muted hover:bg-lr-surface-raised hover:text-lr-text transition-colors text-left"
              >
                <Check className={`h-3 w-3 flex-shrink-0 ${!value ? 'opacity-100 text-lr-accent' : 'opacity-0'}`} />
                No manager
              </button>
              {filtered.length === 0 && query && (
                <p className="px-3 py-2 text-xs text-lr-muted">No results for &quot;{query}&quot;</p>
              )}
              {isGrouped
                ? domains.map((domain) => (
                    <div key={domain}>
                      <p className="px-2 pt-2 pb-0.5 text-[10px] font-semibold text-lr-muted uppercase tracking-wider">
                        @{domain}
                      </p>
                      {grouped[domain].map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => commit(u.id)}
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-lr-surface-raised transition-colors text-left"
                        >
                          <Check className={`h-3 w-3 flex-shrink-0 ${value === u.id ? 'opacity-100 text-lr-accent' : 'opacity-0'}`} />
                          <span className="flex-1 truncate text-lr-text">{u.full_name ?? u.email}</span>
                        </button>
                      ))}
                    </div>
                  ))
                : filtered.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => commit(u.id)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-lr-surface-raised transition-colors text-left"
                    >
                      <Check className={`h-3 w-3 flex-shrink-0 ${value === u.id ? 'opacity-100 text-lr-accent' : 'opacity-0'}`} />
                      <span className="flex-1 truncate text-lr-text">{u.full_name ?? u.email}</span>
                    </button>
                  ))
              }
            </div>
          </div>
        )}
      </div>

      {feedback && (
        <p className={`text-xs ${feedback.type === 'error' ? 'text-lr-error' : 'text-lr-success'} max-w-48 break-words`}>
          {feedback.message}
        </p>
      )}
    </div>
  )
}
