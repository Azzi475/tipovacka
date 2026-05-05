'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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
  const [user, setUser] = useState<any>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
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
    const { error } = await supabase.from('predictions').upsert({
      user_id: user.id,
      match_id: matchId,
      predicted_home_score: home,
      predicted_away_score: away
    }, { onConflict: 'user_id,match_id' })

    if (error) setMessage('Chyba: ' + error.message)
    else {
      setMessage('Tip uložen! 🎯')
      loadData()
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-pulse text-slate-500">Načítání...</div>
    </div>
  )
  
  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md">
        <div className="text-4xl mb-4">👋</div>
        <h1 className="text-2xl font-bold mb-2 text-slate-800">Přihlaste se</h1>
        <p className="text-slate-500 mb-6">Pro zobrazení tipů se prosím přihlaste.</p>
        <Link href="/login" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition">Přihlásit se</Link>
      </div>
    </div>
  )

  const totalPoints = predictions.reduce((sum, p) => sum + (p.points ?? 0), 0)
  const exactCount = predictions.filter(p => p.points === 2 || p.points === 3).length

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-lg text-slate-800 tracking-tight">🏒 Tipovačka</span>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-semibold">{totalPoints} bodů</div>
              <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-semibold">{exactCount} přesných</div>
            </div>
            <button onClick={loadData} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Obnovit">🔄</button>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="text-sm text-slate-500 hover:text-slate-800 font-medium transition">Odhlásit se</button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex sm:hidden gap-3 mb-6">
          <div className="flex-1 bg-blue-50 text-blue-700 px-4 py-3 rounded-xl font-bold text-center">{totalPoints} bodů</div>
          <div className="flex-1 bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl font-bold text-center">{exactCount} přesných</div>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-6">Moje tipy</h1>
        
        {message && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm font-medium animate-fade-in">
            {message}
          </div>
        )}

        <div className="space-y-4">
          {matches.map(match => {
            const pred = getPrediction(match.id)
            const locked = isLocked(match.kickoff_at)
            const isFinished = match.status === 'finished'
            const hasPoints = pred && typeof pred.points === 'number'

            const pts = pred?.points
            const pointsBadge = pts !== null && pts !== undefined ? (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${pts === 0 ? 'bg-slate-100 text-slate-600' : pts === 1 ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {pts} {pts === 1 ? 'bod' : pts > 1 && pts < 5 ? 'body' : 'bodů'}
              </span>
            ) : isFinished ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-500">Netipováno</span>
            ) : null

            return (
              <div key={match.id} className={`bg-white rounded-xl shadow-sm border transition overflow-hidden ${isFinished ? 'border-slate-200' : locked ? 'border-amber-200' : 'border-slate-200 hover:shadow-md'}`}>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {isFinished && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                      {locked && !isFinished && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
                      {!locked && !isFinished && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {isFinished ? 'Dokončeno' : locked ? 'Zamčeno' : 'Otevřeno'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">{new Date(match.kickoff_at).toLocaleString('cs-CZ')}</span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-bold text-slate-800">{match.home_team_name}</span>
                        <span className="text-slate-300 font-bold">vs</span>
                        <span className="text-lg font-bold text-slate-800">{match.away_team_name}</span>
                      </div>
                      {isFinished && match.home_score_regular !== null && (
                        <div className="text-sm font-bold text-emerald-600">
                          Výsledek: {match.home_score_regular} : {match.away_score_regular}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {pred && (
                        <div className="text-2xl font-black text-slate-800 tabular-nums">
                          {pred.predicted_home_score}<span className="text-slate-300 mx-1">:</span>{pred.predicted_away_score}
                        </div>
                      )}
                      {pointsBadge}
                    </div>
                  </div>
                </div>

                {!locked && !isFinished && (
                  <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
                    <TipForm matchId={match.id} current={pred} onSubmit={submitTip} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}

function TipForm({ matchId, current, onSubmit }: { matchId: string, current?: Prediction, onSubmit: (m: string, h: number, a: number) => void }) {
  const [home, setHome] = useState(current?.predicted_home_score ?? '')
  const [away, setAway] = useState(current?.predicted_away_score ?? '')

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(matchId, Number(home), Number(away)) }} className="flex items-center gap-3">
      <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
        <input type="number" min={0} required placeholder="0" className="w-16 p-2 border-0 rounded text-center font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none" value={home} onChange={e => setHome(e.target.value)} />
        <span className="text-slate-400 font-bold">:</span>
        <input type="number" min={0} required placeholder="0" className="w-16 p-2 border-0 rounded text-center font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none" value={away} onChange={e => setAway(e.target.value)} />
      </div>
      <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition shadow-sm hover:shadow">
        {current ? 'Upravit tip' : 'Vsadit'}
      </button>
    </form>
  )
}