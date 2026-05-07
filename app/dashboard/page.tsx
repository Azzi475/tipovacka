'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFlag } from '@/lib/flags'

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
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Moje tipy</h1>
      
      {message && (
        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm font-medium">
          {message}
        </div>
      )}

      <div className="space-y-4">
        {matches.map(match => {
          const pred = getPrediction(match.id)
          const locked = isLocked(match.kickoff_at)
          const isFinished = match.status === 'finished'
          const hasPoints = pred && typeof pred.points === 'number'

          return (
            <div key={match.id} className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border transition-all overflow-hidden ${isFinished ? 'border-slate-200 dark:border-slate-700' : locked ? 'border-amber-200 dark:border-amber-900/50' : 'border-slate-200 dark:border-slate-700 hover:shadow-md'}`}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isFinished ? 'bg-emerald-500' : locked ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {isFinished ? 'Dokončeno' : locked ? 'Zamčeno' : 'Otevřeno'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{new Date(match.kickoff_at).toLocaleString('cs-CZ')}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0 text-center">
                    <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                      <span className="text-2xl leading-none flex-shrink-0">{getFlag(match.home_team_name)}</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">{match.home_team_name}</span>
                      <span className="text-slate-300 dark:text-slate-600 font-bold mx-1">vs</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">{match.away_team_name}</span>
                      <span className="text-2xl leading-none flex-shrink-0">{getFlag(match.away_team_name)}</span>
                    </div>
                    {isFinished && match.home_score_regular !== null && (
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        Výsledek: {match.home_score_regular} : {match.away_score_regular}
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    {pred && (
                      <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                        {pred.predicted_home_score}<span className="text-slate-300 dark:text-slate-600 mx-1">:</span>{pred.predicted_away_score}
                      </div>
                    )}
                    {hasPoints && (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${pred.points === 0 ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400' : pred.points === 1 ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'}`}>
                        {pred.points} {pred.points === 1 ? 'bod' : pred.points && pred.points > 1 && pred.points < 5 ? 'body' : 'bodů'}
                      </span>
                    )}
                    {isFinished && pred && !hasPoints && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">Netipováno</span>
                    )}
                  </div>
                </div>
              </div>

              {!locked && !isFinished && (
                <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700/50 flex justify-center">
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
      <div className="flex items-center gap-2 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 p-1 shadow-sm">
        <input type="number" min={0} required placeholder="0" className="w-16 p-2 border-0 rounded-lg text-center font-bold text-slate-700 dark:text-white bg-transparent focus:ring-2 focus:ring-blue-500 outline-none" value={home} onChange={e => setHome(e.target.value)} />
        <span className="text-slate-400 font-bold">:</span>
        <input type="number" min={0} required placeholder="0" className="w-16 p-2 border-0 rounded-lg text-center font-bold text-slate-700 dark:text-white bg-transparent focus:ring-2 focus:ring-blue-500 outline-none" value={away} onChange={e => setAway(e.target.value)} />
      </div>
      <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm hover:shadow">
        {current ? 'Upravit tip' : 'Vsadit'}
      </button>
    </form>
  )
}