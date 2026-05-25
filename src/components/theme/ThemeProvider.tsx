'use client'

import { createContext, useContext, useState } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggle: () => {},
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

function applyToDOM(next: Theme) {
  localStorage.setItem('lr-theme', next)
  document.documentElement.classList.toggle('dark', next === 'dark')
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Runs only on the client; SSR always returns 'dark' (matches the inline script)
    if (typeof window === 'undefined') return 'dark'
    return (localStorage.getItem('lr-theme') as Theme | null) ?? 'dark'
  })

  function applyTheme(next: Theme) {
    applyToDOM(next)
    setThemeState(next)
  }

  function toggle() {
    applyTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme: applyTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
