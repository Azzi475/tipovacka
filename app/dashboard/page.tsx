'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFlag } from '@/lib/flags'
import Image from 'next/image'

type Match = {
  id: string
  home_team_name: string
  away_team_name: string
  kickoff_at: string
  status: string
  home_score_regular: number | null
  away_score_regular: number | null
}

type Prediction = {
  id: string
  match_id: string
  predicted_home_score: number
  predicted_away_score: number
  points: number | null
}

export default function DashboardPage() {
  const supabase = createClient()
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: tournament } = await supabase.from('tournaments').select('id').eq('is_active', true).single()
    if (tournament) {
      const { data } = await supabase.from('matches').select('*').eq('tournament_id', tournament.id).order('kickoff_at', { ascending: true })
      setMatches(data || [])
    }
    const { data: predData } = await supabase.from('predictions').select('*').eq('user_id', user.id)
    setPredictions(predData || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [supabase])

  const getPrediction = (matchId: string) => predictions.find(p => p.match_id === matchId)
  const isLocked = (kickoff: string) => new Date(kickoff) <= new Date()

  const submitTip = async (matchId: string, home: number, away: number) => {
    setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('predictions').upsert({
      user_id: user.id,
      match_id: matchId,
      predicted_home_score: home,
      predicted_away_score: away
    }, { onConflict: 'user_id,match_id' })

    if (error) setMessage('Chyba: ' + error.message)
    else {
      setMessage('Tip uložen!')
      loadData()
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Načítání...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Moje tipy</h1>
      
      {message && (
        <div className="mb-4 p-3 bg-soft-teal dark:bg-teal/20 border border-teal/30 text-teal dark:text-dark-teal rounded-xl text-sm font-medium">
          {message}
        </div>
      )}

      <div className="space-y-4">
        {matches.map(match => {
          const pred = getPrediction(match.id)
          const locked = isLocked(match.kickoff_at)
          const isFinished = match.status === 'finished'
          const hasPoints = pred && typeof pred.points === 'number'

          const statusConfig: Record<string, { text: string; color: string; dot: string }> = {
            scheduled: { text: locked ? 'ZAMČENO' : 'OTEVŘENO', color: locked ? 'text-amber-500' : 'text-status-open', dot: locked ? 'bg-amber-500' : 'bg-status-open' },
            live: { text: 'ŽIVĚ', color: 'text-red-500', dot: 'bg-red-500' },
            finished: { text: 'VYHODNOCENO', color: 'text-status-finished', dot: 'bg-status-finished' },
            postponed: { text: 'ZRUŠENO', color: 'text-status-cancelled', dot: 'bg-status-cancelled' },
          }
          const status = statusConfig[match.status] || statusConfig.scheduled

          return (
            <div key={match.id} className="relative bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-dark-border overflow-hidden">
              <div className="p-5">
                {/* Pravý horní roh – tip hráče */}
                <div className="absolute top-5 right-5 flex flex-col items-end gap-1 z-10">
                  {pred && (
                    <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                      {pred.predicted_home_score}<span className="text-slate-300 dark:text-slate-600 mx-1">:</span>{pred.predicted_away_score}
                    </div>
                  )}
                  {hasPoints && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${pred.points === 0 ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400' : pred.points === 1 ? 'bg-light-blue dark:bg-dark-primary/30 text-primary-blue dark:text-dark-secondary' : 'bg-soft-teal dark:bg-teal/20 text-teal dark:text-dark-teal'}`}>
                      {pred.points} {pred.points === 1 ? 'bod' : pred.points && pred.points > 1 && pred.points < 5 ? 'body' : 'bodů'}
                    </span>
                  )}
                  {isFinished && !pred && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">Netipováno</span>
                  )}
                </div>

                {/* Status + datum */}
                <div className="flex items-center justify-between mb-4 pr-20">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${status.dot}`}></span>
                    <span className={`text-xs font-semibold uppercase tracking-wider ${status.color}`}>
                      {status.text}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{new Date(match.kickoff_at).toLocaleString('cs-CZ')}</span>
                </div>

                {/* Týmy – na střed */}
                <div className="flex items-center justify-center gap-3 pr-16">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 dark:border-dark-border flex-shrink-0 bg-white">
                      <Image src={getFlag(match.home_team_name)} alt={match.home_team_name} width={40} height={40} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-base font-bold text-slate-900 dark:text-white">{match.home_team_name}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-300 dark:text-slate-600 mx-1">vs</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900 dark:text-white">{match.away_team_name}</span>
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 dark:border-dark-border flex-shrink-0 bg-white">
                      <Image src={getFlag(match.away_team_name)} alt={match.away_team_name} width={40} height={40} className="w-full h-full object-cover" />
                    </div>
                  </div>
                </div>

                {/* Výsledek zápasu */}
                {isFinished && match.home_score_regular !== null && (
                  <div className="text-center mt-3 text-sm font-bold text-status-finished">
                    Výsledek: {match.home_score_regular} : {match.away_score_regular}
                  </div>
                )}
              </div>

              {/* Vsázka */}
              {!locked && !isFinished && (
                <div className="px-5 py-4 bg-slate-50 dark:bg-dark-bg/50 border-t border-slate-100 dark:border-dark-border flex justify-center">
                  <TipForm matchId={match.id} current={pred} onSubmit={submitTip} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TipForm({ matchId, current, onSubmit }: { matchId: string, current?: Prediction, onSubmit: (m: string, h: number, a: number) => void }) {
  const [home, setHome] = useState(current?.predicted_home_score ?? '')
  const [away, setAway] = useState(current?.predicted_away_score ?? '')

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(matchId, Number(home), Number(away)) }} className="flex items-center gap-3">
      <div className="flex items-center gap-2 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-dark-border p-1 shadow-sm">
        <input type="number" min={0} required placeholder="0" className="w-16 p-2 border-0 rounded-lg text-center font-bold text-slate-900 dark:text-white bg-transparent focus:ring-2 focus:ring-primary-blue outline-none" value={home} onChange={e => setHome(e.target.value)} />
        <span className="text-slate-400 font-bold">:</span>
        <input type="number" min={0} required placeholder="0" className="w-16 p-2 border-0 rounded-lg text-center font-bold text-slate-900 dark:text-white bg-transparent focus:ring-2 focus:ring-primary-blue outline-none" value={away} onChange={e => setAway(e.target.value)} />
      </div>
      <button type="submit" className="bg-primary-blue hover:bg-royal-blue dark:bg-dark-primary dark:hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm">
        {current ? 'Upravit tip' : 'Vsadit'}
      </button>
    </form>
  )
}