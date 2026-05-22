'use client'

import { useState, useTransition } from 'react'
import { upsertPulseOption } from '@/lib/actions/admin-actions'
import type { PulseOption } from '@/lib/types/database'

const COLOR_PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan (lr-cyan)
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#7c5cfc', // violet (lr-accent)
  '#a855f7', // purple
  '#ec4899', // pink
]

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function OptionRow({ option }: { option: PulseOption }) {
  const [label, setLabel] = useState(option.label)
  const [color, setColor] = useState(option.color)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = label !== option.label || color !== option.color

  function handleSave() {
    setError(null)
    const fd = new FormData()
    fd.set('id', option.id)
    fd.set('label', label)
    fd.set('color', color)
    startTransition(async () => {
      const result = await upsertPulseOption(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    })
  }

  return (
    <div className="flex items-center gap-4 py-3 border-b border-lr-border/40 last:border-0">
      {/* Emoji + preview swatch */}
      <span className="text-lg w-7 text-center shrink-0">{option.emoji}</span>
      <div
        className="w-5 h-5 rounded-[3px] shrink-0 border border-white/10"
        style={{ backgroundColor: color }}
      />

      {/* Label input */}
      <input
        type="text"
        value={label}
        onChange={(e) => { setLabel(e.target.value); setSaved(false) }}
        maxLength={50}
        className="flex-1 min-w-0 rounded-[var(--radius-lr)] border border-lr-border bg-lr-surface px-3 py-1.5 text-sm text-lr-text placeholder:text-lr-muted focus:outline-none focus:border-lr-accent/60 transition-colors"
      />

      {/* Color swatches */}
      <div className="flex items-center gap-1 shrink-0">
        {COLOR_PALETTE.map((hex) => (
          <button
            key={hex}
            type="button"
            title={hex}
            onClick={() => { setColor(hex); setSaved(false) }}
            className="w-5 h-5 rounded-[3px] border transition-transform hover:scale-110 focus:outline-none"
            style={{
              backgroundColor: hex,
              borderColor: color === hex ? 'white' : 'transparent',
              boxShadow: color === hex ? `0 0 0 1px ${hex}` : 'none',
              transform: color === hex ? 'scale(1.15)' : undefined,
            }}
          />
        ))}
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending || !isDirty || !label.trim()}
        className="shrink-0 rounded-[var(--radius-lr)] px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
        style={isDirty && label.trim() ? { backgroundColor: hexToRgba(color, 0.2), color, borderColor: hexToRgba(color, 0.4), border: '1px solid' } : { background: 'transparent', color: 'var(--color-lr-muted)', border: '1px solid var(--color-lr-border)' }}
      >
        {isPending ? '…' : saved ? '✓ Saved' : 'Save'}
      </button>

      {error && <p className="text-xs text-lr-error ml-1">{error}</p>}
    </div>
  )
}

export default function PulseOptionsAdmin({ options }: { options: PulseOption[] }) {
  const energy = options.filter((o) => o.type === 'energy').sort((a, b) => a.sort_order - b.sort_order)
  const flow = options.filter((o) => o.type === 'flow').sort((a, b) => a.sort_order - b.sort_order)

  if (options.length === 0) {
    return (
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-gold/30 bg-lr-gold-dim px-5 py-4 text-sm text-lr-gold">
        Pulse options table not found. Run migration <code className="font-mono text-xs">00023_pulse_options.sql</code> in Supabase first.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-lr-muted">
        Customise the labels and colours shown on the dashboard pulse card and monthly check-in form.
        The emoji cannot be changed here.
      </p>

      {/* Energy */}
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)]">
        <h3 className="text-card-title mb-1">Energy</h3>
        <p className="text-xs text-lr-muted mb-4">How energised does the employee feel this month?</p>
        <div>
          {energy.map((opt) => <OptionRow key={opt.id} option={opt} />)}
        </div>
      </div>

      {/* Flow */}
      <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5 shadow-[var(--shadow-lr-card)]">
        <h3 className="text-card-title mb-1">Flow</h3>
        <p className="text-xs text-lr-muted mb-4">How productive / in the zone does the employee feel?</p>
        <div>
          {flow.map((opt) => <OptionRow key={opt.id} option={opt} />)}
        </div>
      </div>
    </div>
  )
}
