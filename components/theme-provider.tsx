'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  // Inicializace z localStorage při mountu
  useEffect(() => {
    setMounted(true)
    
    // Zkusíme načíst uložené téma
    const saved = localStorage.getItem('tipovacka-theme') as Theme | null
    
    // Pokud není uložené, použijeme preferenci systému
    if (!saved) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const initialTheme = prefersDark ? 'dark' : 'light'
      setThemeState(initialTheme)
      if (initialTheme === 'dark') {
        document.documentElement.classList.add('dark')
      }
      return
    }
    
    // Aplikujeme uložené téma
    if (saved === 'dark') {
      setThemeState('dark')
      document.documentElement.classList.add('dark')
    } else {
      setThemeState('light')
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Funkce pro explicitní nastavení tématu
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('tipovacka-theme', newTheme)
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Toggle mezi light/dark
  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }, [theme, setTheme])

  // Zabránění hydration mismatch - renderujeme children bez změn dokud není mounted
  // Použijeme suppressHydrationWarning na wrapper
  if (!mounted) {
    return (
      <div suppressHydrationWarning>
        {children}
      </div>
    )
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}