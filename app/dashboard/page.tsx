'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { getFlagPath, getFlagCode } from '@/lib/flags'

type Match = {
  id: string
  home_team_name: string
  away_team_name: string
  kickoff_at: string
  status: 'scheduled' | 'live' | 'finished' | 'postponed'
  home_score_regular: number | null
  away_score_regular: number | null
}

type Prediction = {
  match_id: string
  predicted_home_score: number
  predicted_away_score: number
  points: number | null
}

function TeamFlag({ teamName, size = 40 }: { teamName: string; size?: number }) {
  const [error, setError] = useState(false)
  
  if (error) {
    const code = getFlagCode(teamName)
    return (
      <div 
        className="rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-300 border-2 border-white dark:border-gray-500"
        style={{ width: size, height: size }}
        title={teamName}
      >
        {code.toUpperCase()}
      </div>
    )
  }

  return (
    <Image
      src={getFlagPath(teamName)}
      alt={teamName}
      width={size}
      height={size}
      className="rounded-full object-cover border-2 border-white dark:border-gray-600 shadow-sm"
      unoptimized={true}
      onError={() => setError(true)}
    />
  )
}

export default function TipsPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id')
      .eq('is_active', true)
      .single()

    if (!tournament) {
      setLoading(false)
      return
    }

    const { data: matchesData } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('kickoff_at', { ascending: true })

    const { data: predictionsData } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id)

    const predMap: Record<string, Prediction> = {}
    predictionsData?.forEach((p) => {
      predMap[p.match_id] = p
    })

    setMatches(matchesData || [])
    setPredictions(predMap)
    setLoading(false)
  }

  const handlePredict = async (matchId: string, home: number, away: number) => {
    const supabase = createClient()
    
    // Získáme aktuálního uživatele přímo zde - spolehlivější než stav
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('Nejste přihlášeni')
      return
    }

    // Ošetření NaN
    const homeScore = isNaN(home) ? 0 : home
    const awayScore = isNaN(away) ? 0 : away

    const { error } = await supabase
      .from('predictions')
      .upsert({
        user_id: user.id,
        match_id: matchId,
        predicted_home_score: homeScore,
        predicted_away_score: awayScore,
      }, {
        onConflict: 'user_id,match_id' // Důležité pro správný upsert
      })

    if (error) {
      console.error('Chyba při ukládání tipu:', error)
      alert('Chyba: ' + error.message)
      return
    }

    // Po úspěšném uložení znovu načteme data
    await loadData()
  }

  if (loading) return <div className="text-center py-8 text-gray-500">Načítání...</div>

  if (matches.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Žádné zápasy k dispozici</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 py-4">
      <h2 className="text-[32px] leading-[40px] font-semibold text-text-primary dark:text-white mb-2">Moje tipy</h2>
      {matches.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          prediction={predictions[match.id]}
          onPredict={handlePredict}
        />
      ))}
    </div>
  )
}

function MatchCard({ 
  match, 
  prediction, 
  onPredict 
}: { 
  match: Match
  prediction?: Prediction
  onPredict: (id: string, h: number, a: number) => void
}) {
  // Inicializace pouze při mountu - uživatel může hodnoty měnit
  const [homeScore, setHomeScore] = useState(() => prediction?.predicted_home_score?.toString() || '')
  const [awayScore, setAwayScore] = useState(() => prediction?.predicted_away_score?.toString() || '')
  
  const isLocked = match.status !== 'scheduled'
  const isFinished = match.status === 'finished'
  const hasPrediction = !!prediction

  // Synchronizace pouze když se prediction změní zvenčí (např. po uložení z jiného zařízení)
  // a lokální hodnoty jsou prázdné (nebyly editovány uživatelem)
  useEffect(() => {
    if (!homeScore && prediction?.predicted_home_score !== undefined) {
      setHomeScore(prediction.predicted_home_score.toString())
    }
    if (!awayScore && prediction?.predicted_away_score !== undefined) {
      setAwayScore(prediction.predicted_away_score.toString())
    }
  }, [prediction?.predicted_home_score, prediction?.predicted_away_score])

  const getStatusIcon = () => {
    if (isFinished) return '/icons/status-finished.svg'
    if (isLocked) return '/icons/status-locked.svg'
    return '/icons/status-open.svg'
  }

  const getStatusText = () => {
    if (isFinished) return 'VYHODNOCENO'
    if (isLocked) return 'ČEKÁ SE'
    return 'OTEVŘENO'
  }

  const handleSubmit = () => {
    const home = parseInt(homeScore)
    const away = parseInt(awayScore)
    onPredict(match.id, home, away)
  }

  return (
    <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-border-dark p-5 shadow-sm relative transition-colors">
      {/* Hlavička: Status + Tip badge + Datum */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Image src={getStatusIcon()} alt={getStatusText()} width={16} height={16} unoptimized={true} />
          <span className={`text-xs font-semibold uppercase tracking-wide ${
            isFinished ? 'text-blue-600 dark:text-blue-400' : 
            isLocked ? 'text-amber-600 dark:text-amber-400' : 
            'text-primary-blue dark:text-secondary-dark'
          }`}>
            {getStatusText()}
          </span>
        </div>

        {/* VÝRAZNÝ TIP BADGE - napravo nahoře */}
        {hasPrediction && (
          <div className="flex items-center gap-1.5 bg-light-blue dark:bg-border-dark px-3 py-1.5 rounded-lg border border-primary-blue/20 dark:border-secondary-dark/20">
            <Image src="/icons/target-light.svg" alt="" width={14} height={14} className="dark:hidden" unoptimized={true} />
            <Image src="/icons/target-dark.svg" alt="" width={14} height={14} className="hidden dark:block" unoptimized={true} />
            <span className="text-sm font-bold text-primary-blue dark:text-secondary-dark">
              {prediction.predicted_home_score}:{prediction.predicted_away_score}
            </span>
            {prediction.points !== null && (
              <span className="text-[10px] bg-primary-blue text-white px-1.5 py-0.5 rounded-md font-bold">
                +{prediction.points}
              </span>
            )}
          </div>
        )}

        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
          {new Date(match.kickoff_at).toLocaleString('cs-CZ', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* Týmy s vlajkami */}
      <div className="flex items-center justify-center gap-4 mb-5">
        <div className="flex items-center gap-3 flex-1 justify-end">
          <span className="text-sm font-semibold text-text-primary dark:text-white text-right">{match.home_team_name}</span>
          <TeamFlag teamName={match.home_team_name} size={40} />
        </div>

        <span className="text-sm font-bold text-gray-400 dark:text-gray-500 px-2">VS</span>

        <div className="flex items-center gap-3 flex-1 justify-start">
          <TeamFlag teamName={match.away_team_name} size={40} />
          <span className="text-sm font-semibold text-text-primary dark:text-white">{match.away_team_name}</span>
        </div>
      </div>

      {/* Skóre a tlačítko */}
      <div className="flex items-center justify-center gap-3">
        <input
          type="number"
          min="0"
          value={homeScore}
          onChange={(e) => setHomeScore(e.target.value)}
          disabled={isLocked}
          className="w-14 h-12 text-center text-lg font-bold rounded-xl border-2 border-gray-200 dark:border-border-dark bg-white dark:bg-card-dark text-text-primary dark:text-white focus:border-primary-blue focus:outline-none disabled:opacity-50"
        />
        <span className="text-gray-400 font-bold text-lg">:</span>
        <input
          type="number"
          min="0"
          value={awayScore}
          onChange={(e) => setAwayScore(e.target.value)}
          disabled={isLocked}
          className="w-14 h-12 text-center text-lg font-bold rounded-xl border-2 border-gray-200 dark:border-border-dark bg-white dark:bg-card-dark text-text-primary dark:text-white focus:border-primary-blue focus:outline-none disabled:opacity-50"
        />
        
        {!isLocked ? (
          <button
            onClick={handleSubmit}
            className="bg-primary-blue hover:bg-royal-blue text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors ml-2 active:scale-95"
          >
            {hasPrediction ? 'Upravit tip' : 'Vsadit'}
          </button>
        ) : (
          <div className="ml-2 px-4 py-2.5 text-sm font-semibold text-gray-500 dark:text-gray-400">
            {isFinished ? 'Vyhodnoceno' : 'Uzavřeno'}
          </div>
        )}
      </div>
    </div>
  )
}