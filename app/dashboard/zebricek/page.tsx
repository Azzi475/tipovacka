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
  const [isParticipant, setIsParticipant] = useState<boolean | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: t } = await supabase
          .from('tournaments')
          .select('*')
          .eq('is_active', true)
          .single()

        setTournament(t)

        // Kontrola účasti v turnaji
        const { data: { user } } = await supabase.auth.getUser()
        if (user && t) {
          const { data: participant } = await supabase
            .from('tournament_participants')
            .select('is_active')
            .eq('user_id', user.id)
            .eq('tournament_id', t.id)
            .single()
          setIsParticipant(participant?.is_active === true)
        }

        if (t && !t.leaderboard_closed) {
          const { data: leaderboardData, error: rpcError } = await supabase
            .rpc('get_leaderboard', { tournament_uuid: t.id })

          if (rpcError || !leaderboardData) {
            console.error('RPC error:', rpcError)
            setLeaderboard([])
          } else {
            const { data: profs } = await supabase
              .from('profiles')
              .select('id, nickname, first_name, last_name')

            const map: Record<string, any> = {}
            profs?.forEach((p: any) => map[p.id] = p)

            const enriched = leaderboardData.map((row: any) => ({
              user_id: row.user_id,
              points: Number(row.total_points),
              exact: Number(row.exact_count),
              unique: Number(row.unique_count),
              profile: map[row.user_id]
            }))

            // Tie-breaker: při shodě bodů upřednostnit vyšší unikátní, pak přesné
            enriched.sort((a: any, b: any) => {
              if (b.points !== a.points) return b.points - a.points
              if (b.unique !== a.unique) return b.unique - a.unique
              return b.exact - a.exact
            })

            setLeaderboard(enriched)
          }
        }
      } catch (err) {
        console.error('Chyba při načítání žebříčku:', err)
        setLeaderboard([])
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Načítání...</div>

  // Nezapsaný hráč
  if (isParticipant === false) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-2xl p-8 max-w-md w-full text-center border border-gray-200 dark:border-gray-700 shadow-lg !bg-white/70 dark:!bg-gray-800/70">
          <div className="flex justify-center mb-4">
            <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Žebříček uzavřen</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Žebříček se zobrazí těm, kdo mají vsazeno, po odehrání prvního zápasu.
          </p>
        </div>
      </div>
    )
  }

  // Uzavřený žebříček pro hráče
  if (tournament?.leaderboard_closed) {
    return (
      <div>
        <h1 className="text-[32px] leading-[40px] font-semibold text-text-primary dark:text-white mb-6">Žebříček</h1>
        <div className="bg-white/70 dark:bg-card-dark/70 rounded-2xl p-8 border border-gray-200 dark:border-border-dark shadow-sm text-center !bg-white/70 dark:!bg-card-dark/70">
          <div className="flex justify-center mb-4">
            <Image 
              src={theme === 'dark' ? '/icons/logo-trophy-dark.png' : '/icons/logo-trophy-light.png'}
              alt="Trophy"
              width={80}
              height={80}
              className="rounded-full"
              unoptimized={true}
            />
          </div>
          <h2 className="text-xl font-bold text-text-primary dark:text-white mb-3">Žebříček je uzavřen</h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap text-base">
            {tournament.leaderboard_message || 'Žebříček je dočasně uzavřen. Výsledky budou zveřejněny po skončení turnaje.'}
          </p>
        </div>
      </div>
    )
  }

  const showDetails = tournament?.leaderboard_show_details === true

  return (
    <div>
      <h1 className="text-[32px] leading-[40px] font-semibold text-text-primary dark:text-white mb-6">Žebříček</h1>
      <div className="bg-white/70 dark:bg-card-dark/70 rounded-2xl shadow-sm border border-gray-200 dark:border-border-dark overflow-hidden !bg-white/70 dark:!bg-card-dark/70">
        {/* Hlavička tabulky */}
        <div className="p-4 bg-gray-50 dark:bg-border-dark/50 border-b border-gray-200 dark:border-border-dark">
          <div className={`grid gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
            showDetails ? 'grid-cols-12' : 'grid-cols-12'
          }`}>
            <div className="col-span-1">#</div>
            <div className={showDetails ? 'col-span-5' : 'col-span-11'}>Hráč</div>
            {showDetails && (
              <>
                <div className="col-span-2 text-center">Body</div>
                <div className="col-span-2 text-center">Přesných</div>
                <div className="col-span-2 text-center">Unikátních</div>
              </>
            )}
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-border-dark">
          {leaderboard.length === 0 && (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
              Zatím žádná data. Body se zobrazí po vyhodnocení prvních zápasů.
            </div>
          )}
          {leaderboard.map((row, idx) => {
            const name = row.profile?.nickname || `${row.profile?.first_name || ''} ${row.profile?.last_name || ''}`.trim() || 'Neznámý'
            return (
              <div key={row.user_id} className="p-4 flex items-center hover:bg-gray-50 dark:hover:bg-border-dark/30 transition">
                <div className="w-12 shrink-0">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                    idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' : 
                    idx === 1 ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300' : 
                    idx === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : 
                    'bg-gray-100 dark:bg-border-dark text-gray-600 dark:text-gray-400'
                  }`}>
                    {idx + 1}
                  </span>
                </div>
                <div className={`min-w-0 ${showDetails ? 'flex-1' : 'flex-1'}`}>
                  <div className="font-bold text-text-primary dark:text-white truncate">{name}</div>
                  {row.profile?.nickname && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">{row.profile?.first_name} {row.profile?.last_name}</div>
                  )}
                </div>
                {showDetails && (
                  <div className="flex gap-4 shrink-0 ml-4">
                    <div className="text-center w-16">
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{row.points}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">bodů</div>
                    </div>
                    <div className="text-center w-16">
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{row.exact}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">přesných</div>
                    </div>
                    <div className="text-center w-16">
                      <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{row.unique}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">unikátních</div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}