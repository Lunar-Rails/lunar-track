'use client'

import { useState, useTransition } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { sendKudos } from '@/lib/actions/kudos-actions'

function getInitials(name: string | null, email: string): string {
  if (name) return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

type ProfileEntry = { id: string; full_name: string | null; email: string; avatar_url: string | null }
type CompanyValueEntry = { id: string; name: string }

interface SendKudosSheetProps {
  preselectedRecipient?: ProfileEntry
  profiles: ProfileEntry[]
  companyValues: CompanyValueEntry[]
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

export default function SendKudosSheet({
  preselectedRecipient,
  profiles,
  companyValues,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: SendKudosSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState<ProfileEntry | null>(
    preselectedRecipient ?? null
  )
  const [selectedValue, setSelectedValue] = useState<CompanyValueEntry | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredProfiles = search.trim()
    ? profiles.filter((p) => {
        const q = search.toLowerCase()
        return (
          (p.full_name?.toLowerCase().includes(q) ?? false) ||
          p.email.toLowerCase().includes(q)
        )
      })
    : profiles.slice(0, 8)

  function resetForm() {
    setSearch('')
    setShowDropdown(false)
    setSelectedRecipient(preselectedRecipient ?? null)
    setSelectedValue(null)
    setNote('')
    setError(null)
  }

  function handleOpenChange(v: boolean) {
    if (controlledOnOpenChange) controlledOnOpenChange(v)
    else setInternalOpen(v)
    if (!v) resetForm()
  }

  function handleSubmit() {
    const recipient = selectedRecipient
    if (!recipient) { setError('Please select a recipient'); return }
    if (!selectedValue) { setError('Please select a value'); return }
    if (!note.trim()) { setError('Please add a note'); return }

    setError(null)
    startTransition(async () => {
      const result = await sendKudos({
        recipientId: recipient.id,
        valueId: selectedValue.id,
        valueName: selectedValue.name,
        note,
      })
      if (result.error) {
        setError(result.error)
      } else {
        handleOpenChange(false)
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>

      <SheetContent className="w-full sm:max-w-lg bg-lr-bg border-lr-border flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-lr-border shrink-0">
          <SheetTitle className="text-lr-text text-base font-semibold">Give kudos</SheetTitle>
          <p className="text-xs text-lr-muted mt-0.5">Recognise a teammate for living a company value</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Recipient picker */}
          {preselectedRecipient ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-lr-muted">To</label>
              <div className="flex items-center gap-2.5 rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface/60 px-3 py-2.5">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={preselectedRecipient.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-lr-accent text-white text-[10px]">
                    {getInitials(preselectedRecipient.full_name, preselectedRecipient.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-lr-text">
                  {preselectedRecipient.full_name ?? preselectedRecipient.email}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-lr-muted">To</label>
              <div className="relative">
                {selectedRecipient ? (
                  <div className="flex items-center gap-2.5 rounded-[var(--radius-lr)] border border-lr-accent/40 bg-lr-surface/60 px-3 py-2.5">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={selectedRecipient.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-lr-accent text-white text-[10px]">
                        {getInitials(selectedRecipient.full_name, selectedRecipient.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-lr-text flex-1 min-w-0 truncate">
                      {selectedRecipient.full_name ?? selectedRecipient.email}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setSelectedRecipient(null); setSearch('') }}
                      className="text-lr-muted hover:text-lr-text text-xs shrink-0 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setShowDropdown(e.target.value.length > 0) }}
                    onFocus={() => setShowDropdown(search.length > 0)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    placeholder="Search by name or email…"
                    className="w-full rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface/60 px-3 py-2.5 text-sm text-lr-text placeholder:text-lr-muted/40 focus:outline-none focus:border-lr-accent/60 transition-colors"
                  />
                )}

                {showDropdown && !selectedRecipient && filteredProfiles.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-bg shadow-[var(--shadow-lr-card)] max-h-48 overflow-y-auto">
                    {filteredProfiles.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => {
                          setSelectedRecipient(p)
                          setSearch('')
                          setShowDropdown(false)
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-lr-surface transition-colors text-left"
                      >
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage src={p.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-lr-accent text-white text-[10px]">
                            {getInitials(p.full_name, p.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm text-lr-text truncate">{p.full_name ?? p.email}</p>
                          {p.full_name && (
                            <p className="text-[10px] text-lr-muted truncate">{p.email}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Value selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-lr-muted">Value <span className="text-lr-error">*</span></label>
            {companyValues.length === 0 ? (
              <p className="text-xs text-lr-muted italic">No company values configured.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {companyValues.map((v) => {
                  const isSelected = selectedValue?.id === v.id
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedValue(isSelected ? null : v)}
                      className={[
                        'rounded-full border px-3 py-1 text-sm transition-colors',
                        isSelected
                          ? 'bg-lr-accent text-white border-lr-accent'
                          : 'border-lr-border text-lr-muted hover:bg-lr-surface',
                      ].join(' ')}
                    >
                      {v.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-lr-muted">Note <span className="text-lr-error">*</span></label>
              <span className={`text-[10px] ${note.length > 450 ? 'text-lr-gold' : 'text-lr-muted'}`}>
                {note.length}/500
              </span>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="Describe what they did and why it matters…"
              className="w-full rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface/60 px-3 py-2.5 text-sm text-lr-text placeholder:text-lr-muted/40 focus:outline-none focus:border-lr-accent/60 resize-none leading-relaxed transition-colors"
            />
          </div>

          {error && (
            <div className="rounded-[var(--radius-lr)] border border-lr-error/20 bg-lr-error/10 px-4 py-3">
              <p className="text-xs text-lr-error">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-2 shrink-0">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full rounded-[var(--radius-lr)] bg-lr-accent hover:bg-lr-accent/90 text-white text-sm font-medium py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Sending…' : 'Send kudos'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
