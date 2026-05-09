'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'
import Image from 'next/image'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({ points: 0, exact: 0 })
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data: preds } = await supabase
          .from('predictions')
          .select('points, exact_hit')
          .eq('user_id', user.id)
          .not('points', 'is', null)
        const points = preds?.reduce((sum, p) => sum + (p.points || 0), 0) || 0
        const exact = preds?.filter(p => p.exact_hit === true).length || 0
        setStats({ points, exact })
      }
    }
    load()
  }, [supabase, pathname])

  const navItems = [
    { href: '/dashboard', label: 'Tipy', icon: '/icons/nav-tips' },
    { href: '/dashboard/zebricek', label: 'Žebříček', icon: '/icons/nav-leaderboard' },
    { href: '/dashboard/statistiky', label: 'Statistiky', icon: '/icons/nav-stats' },
    { href: '/dashboard/profil', label: 'Profil', icon: '/icons/nav-profile' },
  ]

  return (
    <div className="min-h-screen bg-bg-light dark:bg-dark-bg transition-colors duration-300 pb-24">
      {/* Horní lišta */}
      <nav className="bg-white dark:bg-dark-card border-b border-slate-200 dark:border-dark-border sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src={theme === 'dark' ? '/images/logo-trophy-dark.png' : '/images/logo-trophy-light.png'} alt="Tipovačka" width={32} height={32} className="rounded-full" />
            <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">Tipovačka</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-dark-border transition text-slate-600 dark:text-slate-300"
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

      {/* Statistiky pod nav */}
      <div className="max-w-3xl mx-auto px-4 pt-4 flex gap-3">
        <div className="flex-1 bg-white dark:bg-dark-card rounded-xl p-3 border border-slate-200 dark:border-dark-border flex items-center justify-center gap-2 shadow-sm">
          <Image src={theme === 'dark' ? '/icons/star-dark.svg' : '/icons/star-light.svg'} alt="Body" width={20} height={20} />
          <span className="text-lg font-bold text-slate-900 dark:text-white">{stats.points}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">bodů</span>
        </div>
        <div className="flex-1 bg-white dark:bg-dark-card rounded-xl p-3 border border-slate-200 dark:border-dark-border flex items-center justify-center gap-2 shadow-sm">
          <Image src={theme === 'dark' ? '/icons/target-dark.svg' : '/icons/target-light.svg'} alt="Přesné" width={20} height={20} />
          <span className="text-lg font-bold text-slate-900 dark:text-white">{stats.exact}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">přesných</span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-4">
        {children}
      </main>

      {/* Spodní navigace */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-dark-card border-t border-slate-200 dark:border-dark-border z-50 transition-colors duration-300 pb-safe">
        <div className="max-w-3xl mx-auto flex justify-around py-2">
          {navItems.map(item => {
            const isActive = pathname === item.href
            const iconSrc = isActive ? `${item.icon}-active.svg` : (theme === 'dark' ? `${item.icon}-dark.svg` : `${item.icon}-light.svg`)
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`flex flex-col items-center py-1 px-4 transition-all ${isActive ? 'text-primary-blue dark:text-dark-primary' : 'text-slate-400 dark:text-slate-500'}`}
              >
                <Image src={iconSrc} alt={item.label} width={24} height={24} className="mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
                {isActive && <div className="w-1 h-1 rounded-full bg-primary-blue dark:bg-dark-primary mt-1"></div>}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}