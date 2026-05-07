'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    load()
  }, [supabase])

  const navItems = [
    { href: '/dashboard', label: 'Tipy', icon: '📋' },
    { href: '/dashboard/zebricek', label: 'Žebříček', icon: '🏆' },
    { href: '/dashboard/statistiky', label: 'Statistiky', icon: '📊' },
    { href: '/dashboard/profil', label: 'Profil', icon: '👤' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 pb-20">
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">Tipovačka</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-600 dark:text-slate-300"
              title={theme === 'light' ? 'Tmavý režim' : 'Světlý režim'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition">
                Odhlásit
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-50 transition-colors duration-300">
        <div className="max-w-3xl mx-auto flex justify-around">
          {navItems.map(item => {
            const isActive = pathname === item.href
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`flex flex-col items-center py-2 px-4 transition-all ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                <span className="text-xl mb-0.5">{item.icon}</span>
                <span className="text-xs font-medium">{item.label}</span>
                {isActive && <div className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400 mt-1"></div>}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}