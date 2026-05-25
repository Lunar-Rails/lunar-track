'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggle: () => {},
  setTheme: () => {},
  mounted: false,
})

export function useTheme() {
  return useContext(ThemeContext)
}

function applyToDOM(next: Theme) {
  localStorage.setItem('lr-theme', next)
  document.documentElement.classList.toggle('dark', next === 'dark')
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = (localStorage.getItem('lr-theme') as Theme | null) ?? 'dark'
    setThemeState(stored)
    setMounted(true)
  }, [])

  function applyTheme(next: Theme) {
    applyToDOM(next)
    setThemeState(next)
  }

  function toggle() {
    applyTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme: applyTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  )
}
