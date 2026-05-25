'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

export default function AppearanceSection() {
  const { theme, setTheme, mounted } = useTheme()

  const active = mounted ? theme : 'dark'

  return (
    <div className="rounded-[var(--radius-lr-lg)] border border-lr-border bg-lr-glass backdrop-blur-[8px] p-5">
      <h2 className="text-sm font-semibold text-lr-text mb-4">Appearance</h2>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={cn(
            'flex flex-1 flex-col items-center gap-2.5 rounded-[var(--radius-lr)] border p-4 text-sm font-medium transition-colors',
            active === 'dark'
              ? 'border-lr-accent bg-lr-accent-dim text-lr-accent'
              : 'border-lr-border bg-lr-surface text-lr-muted hover:border-lr-accent/50 hover:text-lr-text'
          )}
        >
          <Moon className="h-5 w-5" />
          Dark
        </button>
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={cn(
            'flex flex-1 flex-col items-center gap-2.5 rounded-[var(--radius-lr)] border p-4 text-sm font-medium transition-colors',
            active === 'light'
              ? 'border-lr-accent bg-lr-accent-dim text-lr-accent'
              : 'border-lr-border bg-lr-surface text-lr-muted hover:border-lr-accent/50 hover:text-lr-text'
          )}
        >
          <Sun className="h-5 w-5" />
          Light
        </button>
      </div>
    </div>
  )
}
