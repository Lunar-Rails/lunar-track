'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export default function ThemeToggle() {
  const { theme, toggle, mounted } = useTheme()

  if (!mounted) {
    return (
      <span className="flex items-center justify-center h-8 w-8 rounded-[var(--radius-lr)] text-lr-muted" />
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center justify-center h-8 w-8 rounded-[var(--radius-lr)] text-lr-muted hover:text-lr-text hover:bg-lr-surface transition-colors"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
