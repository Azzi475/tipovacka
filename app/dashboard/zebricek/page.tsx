'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/theme-provider'

export default function ZebricekPage() {
  const supabase = createClient()
  const { theme } = useTheme()
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

  if (loading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Načítání...</div>

  if (tournament?.leaderboard_closed) {
    return (
      <div>
        <h1 className="text-[32px] leading-[40px] font-semibold text-text-primary dark:text-white mb-6">Žebříček</h1>
        <div className="bg-white dark:bg-card-dark rounded-2xl p-8 border border-gray-200 dark:border-border-dark shadow-sm text-center">
          <div className="flex justify-center mb-4">
            <Image 
              src={theme === 'dark' ? '/icons/logo-trophy-dark.png' : '/icons/logo-trophy-light.png'}
              alt="Trophy"
              width={64}
              height={64}
              className="rounded-full"
              unoptimized={true}
            />
          </div>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {tournament.leaderboard_message || 'Žebříček je dočasně uzavřen.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-[32px] leading-[40px] font-semibold text-text-primary dark:text-white mb-6">Žebříček</h1>
      <div className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-gray-200 dark:border-border-dark overflow-hidden">
        <div className="p-4 bg-gray-50 dark:bg-border-dark/50 border-b border-gray-200 dark:border-border-dark">
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <div className="col-span-2">#</div>
            <div className="col-span-10">Hráč</div>
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-border-dark">
          {leaderboard.length === 0 && (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">Zatím žádná data</div>
          )}
          {leaderboard.map((row, idx) => {
            const name = row.profile?.nickname || `${row.profile?.first_name || ''} ${row.profile?.last_name || ''}`.trim() || 'Neznámý'
            return (
              <div key={row.user_id} className="p-4 flex items-center hover:bg-gray-50 dark:hover:bg-border-dark/30 transition">
                <div className="w-12">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                    idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' : 
                    idx === 1 ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300' : 
                    idx === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : 
                    'bg-gray-100 dark:bg-border-dark text-gray-600 dark:text-gray-400'
                  }`}>
                    {idx + 1}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-text-primary dark:text-white">{name}</div>
                  {row.profile?.nickname && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">{row.profile?.first_name} {row.profile?.last_name}</div>
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