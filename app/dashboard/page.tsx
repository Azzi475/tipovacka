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

// WEBP vlajka s fallbackem
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
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

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
    const { error } = await supabase
      .from('predictions')
      .upsert({
        user_id: userId,
        match_id: matchId,
        predicted_home_score: home,
        predicted_away_score: away,
      })

    if (!error) loadData()
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
  const [homeScore, setHomeScore] = useState(prediction?.predicted_home_score?.toString() || '')
  const [awayScore, setAwayScore] = useState(prediction?.predicted_away_score?.toString() || '')
  
  const isLocked = match.status !== 'scheduled'
  const isFinished = match.status === 'finished'
  
  const isOpen = match.status === 'scheduled'
  const hasPrediction = !!prediction

  return (
    <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-border-dark p-5 shadow-sm relative transition-colors">
      {/* Status a datum */}
      <div className="flex items-center justify-between mb-4">
        <div className="status-chip-open">
          <span className="status-dot"></span>
          OTEVŘENO
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
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
      <div className="flex items-center justify-center gap-3 mb-5">
        <div className="flex items-center gap-2 flex-1 justify-end">
          <span className="text-sm font-semibold text-text-primary dark:text-white text-right">{match.home_team_name}</span>
          <TeamFlag teamName={match.home_team_name} size={40} />
        </div>

        <span className="text-sm font-bold text-gray-400 dark:text-gray-500 px-2">VS</span>

        <div className="flex items-center gap-2 flex-1 justify-start">
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
        
        {isOpen ? (
          <button
            onClick={() => onPredict(match.id, parseInt(homeScore) || 0, parseInt(awayScore) || 0)}
            className="bg-primary-blue hover:bg-royal-blue text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors ml-2"
          >
            {hasPrediction ? 'Upravit tip' : 'Vsadit'}
          </button>
        ) : (
          <div className="ml-2 px-4 py-2.5 text-sm font-semibold text-gray-500">
            {isFinished ? 'Vyhodnoceno' : 'Uzavřeno'}
          </div>
        )}
      </div>

      {/* Zobrazení existujícího tipu */}
      {prediction && !isFinished && (
        <div className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
          Váš tip: {prediction.predicted_home_score}:{prediction.predicted_away_score}
          {prediction.points !== null && <span className="ml-2 text-primary-blue dark:text-secondary-dark font-semibold">+{prediction.points} bodů</span>}
        </div>
      )}
    </div>
  )
}