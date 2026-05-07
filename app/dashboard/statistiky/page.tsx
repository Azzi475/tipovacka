'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function StatistikyPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: preds } = await supabase.from('predictions').select('*').eq('user_id', user.id).not('points', 'is', null)
      if (!preds || preds.length === 0) { setLoading(false); return }

      const total = preds.length
      const exact = preds.filter((p: any) => p.points === 2 || p.points === 3).length
      const winner = preds.filter((p: any) => p.points === 1).length
      const zero = preds.filter((p: any) => p.points === 0).length
      const totalPoints = preds.reduce((sum: number, p: any) => sum + (p.points || 0), 0)

      setStats({ total, exact, winner, zero, totalPoints })
      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Načítání...</div>
  if (!stats) return <div className="p-8 text-center text-slate-400 dark:text-slate-500">Zatím nemáš žádné vyhodnocené tipy.</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Statistiky</h1>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard label="Celkem bodů" value={stats.totalPoints} color="text-blue-600 dark:text-blue-400" />
        <StatCard label="Přesné tipy" value={stats.exact} color="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Správný vítěz" value={stats.winner} color="text-purple-600 dark:text-purple-400" />
        <StatCard label="Celkem tipů" value={stats.total} color="text-slate-800 dark:text-slate-200" />
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className={`text-3xl font-black mb-1 ${color}`}>{value}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}