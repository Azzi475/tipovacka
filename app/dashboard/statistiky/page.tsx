'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/theme-provider'

export default function StatistikyPage() {
  const supabase = createClient()
  const { theme } = useTheme()
  const [stats, setStats] = useState({
    totalTips: 0,
    exactHits: 0,
    winnerHits: 0,
    totalPoints: 0,
    uniqueExact: 0,
    accuracy: 0,
    finishedMatches: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }

        // Načtení všech predictions uživatele s body
        const { data: predictions } = await supabase
          .from('predictions')
          .select('points, exact_hit, winner_or_draw_hit, unique_exact')
          .eq('user_id', user.id)
          .not('points', 'is', null)

        if (predictions && predictions.length > 0) {
          const totalTips = predictions.length
          const exactHits = predictions.filter(p => p.exact_hit === true).length
          const winnerHits = predictions.filter(p => p.winner_or_draw_hit === true).length
          const totalPoints = predictions.reduce((sum, p) => sum + (p.points || 0), 0)
          const uniqueExact = predictions.filter(p => p.unique_exact === true).length

          // Úspěšnost = (exact + winner) / total * 100
          const accuracy = totalTips > 0 
            ? Math.round(((exactHits + winnerHits) / totalTips) * 100) 
            : 0

          setStats({
            totalTips,
            exactHits,
            winnerHits,
            totalPoints,
            uniqueExact,
            accuracy,
            finishedMatches: totalTips,
          })
        }
      } catch (err) {
        console.error('Chyba při načítání statistik:', err)
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Načítání...</div>

  return (
    <div>
      <h1 className="text-[32px] leading-[40px] font-semibold text-text-primary dark:text-white mb-6">
        Statistiky
      </h1>

      {/* Hlavní statistiky */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl p-5 border border-gray-200 dark:border-border-dark shadow-sm text-center" style={{ backgroundColor: theme === 'dark' ? 'rgba(26, 39, 64, 0.7)' : 'rgba(255, 255, 255, 0.7)' }}>
          <div className="text-3xl font-black text-primary-blue dark:text-secondary-dark mb-1">
            {stats.totalPoints}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Celkem bodů</div>
        </div>
        <div className="rounded-2xl p-5 border border-gray-200 dark:border-border-dark shadow-sm text-center" style={{ backgroundColor: theme === 'dark' ? 'rgba(26, 39, 64, 0.7)' : 'rgba(255, 255, 255, 0.7)' }}>
          <div className="text-3xl font-black text-emerald-500 dark:text-emerald-400 mb-1">
            {stats.accuracy}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Úspěšnost</div>
        </div>
      </div>

      {/* Detailní statistiky */}
      <div className="rounded-2xl border border-gray-200 dark:border-border-dark shadow-sm overflow-hidden mb-6" style={{ backgroundColor: theme === 'dark' ? 'rgba(26, 39, 64, 0.7)' : 'rgba(255, 255, 255, 0.7)' }}>
        <div className="p-4 border-b border-gray-100 dark:border-border-dark">
          <h2 className="font-bold text-text-primary dark:text-white">Detailní přehled</h2>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-border-dark">
          <StatRow 
            icon={theme === 'dark' ? '/icons/target-dark.svg' : '/icons/target-light.svg'}
            label="Přesné tipy (skóre)"
            value={stats.exactHits}
            sublabel="3 body za unikátní, 2 body za sdílený"
          />
          <StatRow 
            icon={theme === 'dark' ? '/icons/star-dark.svg' : '/icons/star-light.svg'}
            label="Unikátní přesné tipy"
            value={stats.uniqueExact}
            sublabel="Jediný hráč s přesným skóre"
          />
          <StatRow 
            icon={theme === 'dark' ? '/icons/nav-leaderboard-dark.svg' : '/icons/nav-leaderboard-light.svg'}
            label="Správný vítěz/remíza"
            value={stats.winnerHits}
            sublabel="1 bod za správného vítěze"
          />
          <StatRow 
            icon={theme === 'dark' ? '/icons/nav-tips-dark.svg' : '/icons/nav-tips-light.svg'}
            label="Vyhodnocené zápasy"
            value={stats.finishedMatches}
            sublabel="Počet zápasů s přidělenými body"
          />
        </div>
      </div>

      {/* Bodovací systém */}
      <div className="rounded-2xl border border-gray-200 dark:border-border-dark shadow-sm p-5" style={{ backgroundColor: theme === 'dark' ? 'rgba(26, 39, 64, 0.7)' : 'rgba(255, 255, 255, 0.7)' }}>
        <h2 className="font-bold text-text-primary dark:text-white mb-4">Bodovací systém</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-700 dark:text-yellow-300 font-bold text-sm">3</div>
            <div>
              <div className="text-sm font-semibold text-text-primary dark:text-white">Unikátní přesný tip</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Jediný hráč s přesným skóre</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-sm">2</div>
            <div>
              <div className="text-sm font-semibold text-text-primary dark:text-white">Sdílený přesný tip</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Správné skóre s dalšími hráči</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-sm">1</div>
            <div>
              <div className="text-sm font-semibold text-text-primary dark:text-white">Správný vítěz/remíza</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Správně tipnutý výsledek bez přesného skóre</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatRow({ icon, label, value, sublabel }: { icon: string, label: string, value: number, sublabel: string }) {
  return (
    <div className="p-4 flex items-center gap-3">
      <Image src={icon} alt="" width={20} height={20} unoptimized={true} className="opacity-60" />
      <div className="flex-1">
        <div className="text-sm text-gray-600 dark:text-gray-300">{label}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500">{sublabel}</div>
      </div>
      <div className="text-xl font-bold text-text-primary dark:text-white">{value}</div>
    </div>
  )
}