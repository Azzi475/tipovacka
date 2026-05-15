'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [stats, setStats] = useState({ points: 0, exact: 0 })
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: preds } = await supabase
          .from('predictions')
          .select('points, exact_hit')
          .eq('user_id', user.id)

        const points = preds?.reduce((sum, p) => sum + (p.points || 0), 0) || 0
        const exact = preds?.filter(p => p.exact_hit === true).length || 0

        setStats({ points, exact })
      } catch (err) {
        console.error('Chyba při načítání statistik:', err)
      }
    }
    load()
  }, [supabase, pathname])

  const navItems = [
    { href: '/dashboard', label: 'Tipy', icon: 'nav-tips' },
    { href: '/dashboard/zebricek', label: 'Žebříček', icon: 'nav-leaderboard' },
    { href: '/dashboard/statistiky', label: 'Statistiky', icon: 'nav-stats' },
    { href: '/dashboard/profil', label: 'Profil', icon: 'nav-profile' },
  ]

  const logoSrc = theme === 'dark' ? '/icons/logo-trophy-dark.png' : '/icons/logo-trophy-light.png'

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark transition-colors duration-300 pb-24">
      {/* Horní lišta */}
      <nav className="bg-white dark:bg-card-dark border-b border-gray-200 dark:border-border-dark sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src={logoSrc} alt="Tipovačka" width={32} height={32} className="rounded-full" unoptimized={true} />
            <span className="font-bold text-lg text-text-primary dark:text-white tracking-tight">Tipovačka</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-border-dark transition text-gray-600 dark:text-gray-300"
            >
              <Image 
                src={theme === 'light' ? '/icons/theme-moon.svg' : '/icons/theme-sun.svg'} 
                alt="Theme" 
                width={20} 
                height={20} 
                unoptimized={true} 
              />
            </button>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="text-sm bg-primary-blue hover:bg-royal-blue text-white px-4 py-2 rounded-lg font-medium transition">
                Odhlásit
              </button>
            </form>
          </div>
        </div>
      </nav>

      {/* Statistiky - hráč vidí své body */}
      <div className="max-w-3xl mx-auto px-4 pt-4 flex gap-3">
        <div className="flex-1 bg-white dark:bg-card-dark rounded-xl p-3 border border-gray-200 dark:border-border-dark flex items-center justify-center gap-2 shadow-sm transition-colors">
          <Image src={theme === 'dark' ? '/icons/star-dark.svg' : '/icons/star-light.svg'} alt="Body" width={20} height={20} unoptimized={true} />
          <span className="text-lg font-bold text-text-primary dark:text-white">{stats.points}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">bodů</span>
        </div>
        <div className="flex-1 bg-white dark:bg-card-dark rounded-xl p-3 border border-gray-200 dark:border-border-dark flex items-center justify-center gap-2 shadow-sm transition-colors">
          <Image src={theme === 'dark' ? '/icons/target-dark.svg' : '/icons/target-light.svg'} alt="Přesné" width={20} height={20} unoptimized={true} />
          <span className="text-lg font-bold text-text-primary dark:text-white">{stats.exact}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">přesných</span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-4">
        {children}
      </main>

      {/* Spodní navigace */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-card-dark border-t border-gray-200 dark:border-border-dark z-50 transition-colors duration-300">
        <div className="max-w-3xl mx-auto flex justify-around py-2">
          {navItems.map(item => {
            const isActive = pathname === item.href
            const iconSrc = isActive 
              ? `/icons/${item.icon}-active.svg` 
              : (theme === 'dark' ? `/icons/${item.icon}-dark.svg` : `/icons/${item.icon}-light.svg`)
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`flex flex-col items-center py-1 px-4 transition-all ${isActive ? 'text-primary-blue dark:text-secondary-dark' : 'text-gray-400 dark:text-gray-500'}`}
              >
                <Image src={iconSrc} alt={item.label} width={24} height={24} className="mb-1" unoptimized={true} />
                <span className="text-xs font-medium">{item.label}</span>
                {isActive && <div className="w-1 h-1 rounded-full bg-primary-blue dark:bg-secondary-dark mt-1"></div>}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}