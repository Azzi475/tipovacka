'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function StatisticsPage() {
  const [stats, setStats] = useState({
    totalPredictions: 0,
    exactHits: 0,
    winnerHits: 0,
    totalPoints: 0,
    uniqueExact: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: predictions } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id)

    if (!predictions) {
      setLoading(false)
      return
    }

    setStats({
      totalPredictions: predictions.length,
      exactHits: predictions.filter((p) => p.exact_hit).length,
      winnerHits: predictions.filter((p) => p.winner_or_draw_hit).length,
      totalPoints: predictions.reduce((sum, p) => sum + (p.points || 0), 0),
      uniqueExact: predictions.filter((p) => p.unique_exact).length,
    })
    setLoading(false)
  }

  if (loading) return <div className="text-center py-8">Načítání...</div>

  return (
    <div className="py-4 space-y-4">
      <h2 className="text-[32px] leading-[40px] font-semibold text-text-primary dark:text-white mb-4">
        Statistiky
      </h2>

      <StatCard label="Celkem tipů" value={stats.totalPredictions} icon="target" />
      <StatCard label="Přesné tipy" value={stats.exactHits} icon="target" highlight />
      <StatCard label="Správní vítězové" value={stats.winnerHits} icon="star" />
      <StatCard label="Jedinečné přesné" value={stats.uniqueExact} icon="star" highlight />
      <StatCard label="Celkem bodů" value={stats.totalPoints} icon="star" primary />

      <div className="card p-6 mt-4">
        <h3 className="text-lg font-semibold text-text-primary dark:text-white mb-4">
          Úspěšnost
        </h3>
        <div className="space-y-3">
          <ProgressBar label="Přesné tipy" value={stats.exactHits} max={stats.totalPredictions} color="bg-teal" />
          <ProgressBar label="Správní vítězové" value={stats.winnerHits} max={stats.totalPredictions} color="bg-primary-blue" />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, highlight, primary }: { 
  label: string; 
  value: number; 
  icon: string;
  highlight?: boolean;
  primary?: boolean;
}) {
  return (
    <div className={`card p-4 flex items-center justify-between ${highlight ? 'border-l-4 border-teal' : ''} ${primary ? 'border-l-4 border-primary-blue' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          highlight ? 'bg-soft-teal dark:bg-teal/20' : primary ? 'bg-light-blue dark:bg-border-dark' : 'bg-gray-100 dark:bg-border-dark'
        }`}>
          <Image src={`/icons/${icon}-light.svg`} alt="" width={20} height={20} className="dark:hidden" unoptimized={true} />
          <Image src={`/icons/${icon}-dark.svg`} alt="" width={20} height={20} className="hidden dark:block" unoptimized={true} />
        </div>
        <span className="text-gray-600 dark:text-gray-300">{label}</span>
      </div>
      <span className={`text-2xl font-bold ${
        primary ? 'text-primary-blue dark:text-secondary-dark' : highlight ? 'text-teal dark:text-teal-dark' : 'text-text-primary dark:text-white'
      }`}>
        {value}
      </span>
    </div>
  )
}

function ProgressBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600 dark:text-gray-300">{label}</span>
        <span className="font-semibold text-text-primary dark:text-white">{percentage}%</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-border-dark rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}