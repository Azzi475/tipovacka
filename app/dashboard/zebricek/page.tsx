'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ZebricekPage() {
  const supabase = createClient()
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [tournament, setTournament] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase.from('tournaments').select('*').eq('is_active', true).single()
      setTournament(t)

      if (t && !t.leaderboard_closed) {
        const { data: preds } = await supabase.from('predictions').select('user_id, exact_hit').not('points', 'is', null)
        const { data: profs } = await supabase.from('profiles').select('id, nickname, first_name, last_name')
        
        if (preds && profs) {
          const map: Record<string, any> = {}
          profs.forEach((p: any) => map[p.id] = p)
          const grouped: Record<string, any> = {}
          preds.forEach((row: any) => {
            if (!grouped[row.user_id]) grouped[row.user_id] = { user_id: row.user_id, profile: map[row.user_id], exact: 0 }
            if (row.exact_hit) grouped[row.user_id].exact += 1
          })
          setLeaderboard(Object.values(grouped).sort((a: any, b: any) => b.exact - a.exact))
        }
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Načítání...</div>

  // Pokud je žebříček uzavřený, zobrazí se zpráva admina
  if (tournament?.leaderboard_closed) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Žebříček</h1>
        <div className="bg-white dark:bg-dark-card rounded-2xl p-8 border border-slate-200 dark:border-dark-border shadow-sm text-center">
          <div className="text-4xl mb-4">🏆</div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
            {tournament.leaderboard_message || 'Žebříček je dočasně uzavřen.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Žebříček</h1>
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-dark-border overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-dark-border/50 border-b border-slate-200 dark:border-dark-border">
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <div className="col-span-2">#</div>
            <div className="col-span-10">Hráč</div>
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-dark-border">
          {leaderboard.length === 0 && (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">Zatím žádná data</div>
          )}
          {leaderboard.map((row, idx) => {
            const name = row.profile?.nickname || `${row.profile?.first_name || ''} ${row.profile?.last_name || ''}`.trim() || 'Neznámý'
            return (
              <div key={row.user_id} className="p-4 flex items-center hover:bg-slate-50 dark:hover:bg-dark-border/30 transition">
                <div className="w-12">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' : idx === 1 ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300' : idx === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : 'bg-slate-100 dark:bg-dark-border text-slate-600 dark:text-slate-400'}`}>
                    {idx + 1}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-900 dark:text-white">{name}</div>
                  {row.profile?.nickname && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">{row.profile?.first_name} {row.profile?.last_name}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}