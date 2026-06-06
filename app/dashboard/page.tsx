'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { getFlagPath, getFlagCode, getCzechName } from '@/lib/flags'

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
  const [showFinished, setShowFinished] = useState(false)
  const [bgTheme, setBgTheme] = useState<string | null>(null)
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [adminModalText, setAdminModalText] = useState('')
  const [isParticipant, setIsParticipant] = useState<boolean | null>(null)

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
      .select('id, admin_message, admin_message_sent_at, admin_message_target, background_theme')
      .eq('is_active', true)
      .single()

    if (!tournament) {
      setLoading(false)
      return
    }

    // Nastavení pozadí
    setBgTheme(tournament.background_theme || null)

    // Kontrola admin zprávy
    if (tournament.admin_message && tournament.admin_message_sent_at) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_message_dismissed_at')
        .eq('id', user.id)
        .single()

      const msgTime = new Date(tournament.admin_message_sent_at).getTime()
      const dismissedTime = profile?.last_message_dismissed_at
        ? new Date(profile.last_message_dismissed_at).getTime()
        : 0

      let shouldShow = msgTime > dismissedTime

      if (shouldShow && tournament.admin_message_target === 'active') {
        const { data: participantCheck } = await supabase
          .from('tournament_participants')
          .select('is_active')
          .eq('user_id', user.id)
          .eq('tournament_id', tournament.id)
          .single()
        shouldShow = participantCheck?.is_active === true
      }

      if (shouldShow) {
        setAdminModalText(tournament.admin_message)
        setShowAdminModal(true)
      }
    }

    // Kontrola účasti v turnaji
    const { data: participant } = await supabase
      .from('tournament_participants')
      .select('is_active')
      .eq('user_id', user.id)
      .eq('tournament_id', tournament.id)
      .single()

    setIsParticipant(participant?.is_active === true)
    if (tournament.admin_message && tournament.admin_message_sent_at) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_message_dismissed_at')
        .eq('id', user.id)
        .single()

      const msgTime = new Date(tournament.admin_message_sent_at).getTime()
      const dismissedTime = profile?.last_message_dismissed_at
        ? new Date(profile.last_message_dismissed_at).getTime()
        : 0

      let shouldShow = msgTime > dismissedTime

      // Pokud je zpráva jen pro aktivní hráče, ověř účast
      if (shouldShow && tournament.admin_message_target === 'active') {
        const { data: participant } = await supabase
          .from('tournament_participants')
          .select('is_active')
          .eq('user_id', user.id)
          .eq('tournament_id', tournament.id)
          .single()
        shouldShow = participant?.is_active === true
      }

      if (shouldShow) {
        setAdminModalText(tournament.admin_message)
        setShowAdminModal(true)
      }
    }

    const { data: matchesData } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('kickoff_at', { ascending: true })

    const matchIds = matchesData?.map((m: any) => m.id) || []
    const { data: predictionsData } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id)
      .in('match_id', matchIds)

    const predMap: Record<string, Prediction> = {}
    predictionsData?.forEach((p) => {
      predMap[p.match_id] = p
    })

    setMatches(matchesData || [])
    setPredictions(predMap)
    setLoading(false)
  }

  async function dismissAdminMessage() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('profiles')
      .update({ last_message_dismissed_at: new Date().toISOString() })
      .eq('id', user.id)

    setShowAdminModal(false)
  }

  const handlePredict = async (matchId: string, home: number, away: number) => {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('Nejste přihlášeni')
      return
    }

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
        onConflict: 'user_id,match_id'
      })

    if (error) {
      console.error('Chyba při ukládání tipu:', error)
      alert('Chyba: ' + error.message)
      return
    }

    await loadData()
  }

  // Filtrování zápasů
  const visibleMatches = showFinished 
    ? matches 
    : matches.filter(m => m.status !== 'finished')

  if (loading) return (
    <div className="relative z-10 text-center py-8 text-gray-500 dark:text-gray-400">
      Načítání...
    </div>
  )

  if (isParticipant === false) {
    return (
      <div className="relative min-h-screen">
        {/* Modal admin zprávy */}
        {showAdminModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700 my-auto">
              <div className="flex justify-center mb-4 shrink-0">
                <Image src="/icons/logo-trophy-light.png" alt="Info" width={48} height={48} className="dark:hidden" unoptimized={true} />
                <Image src="/icons/logo-trophy-dark.png" alt="Info" width={48} height={48} className="hidden dark:block" unoptimized={true} />
              </div>
              <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-4 shrink-0">Zpráva od admina</h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-6 leading-relaxed">{adminModalText}</p>
              <button onClick={dismissAdminMessage} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition shrink-0">OK, rozumím</button>
            </div>
          </div>
        )}
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center border border-gray-200 dark:border-gray-700 shadow-lg">
            <div className="flex justify-center mb-4">
              <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Nejste zapsáni</h2>
            <p className="text-gray-600 dark:text-gray-300">
              Do tohoto turnaje nejste zapsáni. Kontaktujte admina pro přidání.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="relative z-10 text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Žádné zápasy k dispozici</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      {/* Pozadí turnaje */}
      {bgTheme && (
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `url(/images/${bgTheme}.png)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.5,
          }}
        />
      )}

      {/* Modal admin zprávy */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700 my-auto">
            <div className="flex justify-center mb-4 shrink-0">
              <Image 
                src="/icons/logo-trophy-light.png" 
                alt="Info" 
                width={48} 
                height={48} 
                className="dark:hidden"
                unoptimized={true} 
              />
              <Image 
                src="/icons/logo-trophy-dark.png" 
                alt="Info" 
                width={48} 
                height={48} 
                className="hidden dark:block"
                unoptimized={true} 
              />
            </div>
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-4 shrink-0">
              Zpráva od admina
            </h2>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-6 leading-relaxed">
              {adminModalText}
            </p>
            <button
              onClick={dismissAdminMessage}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition shrink-0"
            >
              OK, rozumím
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 space-y-4 py-4">
        {/* Hlavička s toggle */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[32px] leading-[40px] font-semibold text-text-primary dark:text-white">Moje tipy</h2>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Zobrazit odehrané</span>
            <button
              onClick={() => setShowFinished(!showFinished)}
              className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                showFinished ? 'bg-primary-blue' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                  showFinished ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {visibleMatches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            prediction={predictions[match.id]}
            onPredict={handlePredict}
          />
        ))}

        {!showFinished && matches.filter(m => m.status === 'finished').length > 0 && (
          <div className="text-center py-4 text-gray-400 dark:text-gray-500 text-sm">
            {matches.filter(m => m.status === 'finished').length} odehraných zápasů skryto
          </div>
        )}
      </div>
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
  const [homeScore, setHomeScore] = useState(() => prediction?.predicted_home_score?.toString() || '')
  const [awayScore, setAwayScore] = useState(() => prediction?.predicted_away_score?.toString() || '')

  const now = new Date()
  const kickoff = new Date(match.kickoff_at)
  const isTimeLocked = now.getTime() >= kickoff.getTime()

  const isFinished = match.status === 'finished'
  const isLive = match.status === 'live'

  const isLocked = isFinished || isLive || isTimeLocked || match.status === 'postponed'

  const hasPrediction = !!prediction

  useEffect(() => {
    if (prediction?.predicted_home_score !== undefined) {
      setHomeScore(prediction.predicted_home_score.toString())
    }
    if (prediction?.predicted_away_score !== undefined) {
      setAwayScore(prediction.predicted_away_score.toString())
    }
  }, [prediction?.predicted_home_score, prediction?.predicted_away_score])

  const getStatusIcon = () => {
    if (isFinished) return '/icons/status-finished.svg'
    if (isLive || isTimeLocked) return '/icons/status-locked.svg'
    return '/icons/status-open.svg'
  }

  const getStatusText = () => {
    if (isFinished) return 'KONEC'
    if (isLive || isTimeLocked) return 'UZAMČENO'
    return 'OTEVŘENO'
  }

  const getStatusColor = () => {
    if (isFinished) return 'text-blue-600 dark:text-blue-400'
    if (isLive || isTimeLocked) return 'text-amber-600 dark:text-amber-400'
    return 'text-primary-blue dark:text-secondary-dark'
  }

  const handleSubmit = () => {
    const home = parseInt(homeScore)
    const away = parseInt(awayScore)
    onPredict(match.id, home, away)
  }

  // ========== LAYOUT PRO ODEHRANÉ ZÁPASY ==========
  if (isFinished) {
    return (
      <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-border-dark p-5 shadow-sm relative transition-colors opacity-80">
        {/* Horní řádek - status a čas */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Image src={getStatusIcon()} alt={getStatusText()} width={16} height={16} unoptimized={true} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {kickoff.toLocaleString('cs-CZ', {
              day: 'numeric',
              month: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {/* Týmy - vlajky nahoře, názvy vycentrované pod nimi */}
        <div className="flex items-center justify-center gap-6 mb-4">
          {/* Domácí */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamFlag teamName={match.home_team_name} size={48} />
            <span className="text-sm font-semibold text-text-primary dark:text-white text-center">
              {getCzechName(match.home_team_name)}
            </span>
          </div>

          {/* Skóre */}
          <div className="flex flex-col items-center px-4">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {match.home_score_regular} : {match.away_score_regular}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-1">Výsledek</span>
          </div>

          {/* Hosté */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamFlag teamName={match.away_team_name} size={48} />
            <span className="text-sm font-semibold text-text-primary dark:text-white text-center">
              {getCzechName(match.away_team_name)}
            </span>
          </div>
        </div>

        {/* Tip hráče */}
        {hasPrediction && (
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">Tvůj tip:</span>
            <span className="text-sm font-bold text-primary-blue dark:text-secondary-dark">
              {prediction.predicted_home_score}:{prediction.predicted_away_score}
            </span>
            {prediction.points !== null && prediction.points !== undefined && (
              <span className="text-[10px] bg-primary-blue text-white px-1.5 py-0.5 rounded-md font-bold">
                +{prediction.points}
              </span>
            )}
          </div>
        )}

        {/* Poslední řádek - vyhodnoceno */}
        <div className="text-center">
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            Vyhodnoceno
          </span>
        </div>
      </div>
    )
  }

  // ========== LAYOUT PRO BĚŽNÉ ZÁPASY (původní) ==========
  return (
    <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-border-dark p-5 shadow-sm relative transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Image src={getStatusIcon()} alt={getStatusText()} width={16} height={16} unoptimized={true} />
          <span className={`text-xs font-semibold uppercase tracking-wide ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        {hasPrediction && (
          <div className="flex items-center gap-1.5 bg-light-blue dark:bg-border-dark px-3 py-1.5 rounded-lg border border-primary-blue/20 dark:border-secondary-dark/20">
            <Image src="/icons/target-light.svg" alt="" width={14} height={14} className="dark:hidden" unoptimized={true} />
            <Image src="/icons/target-dark.svg" alt="" width={14} height={14} className="hidden dark:block" unoptimized={true} />
            <span className="text-sm font-bold text-primary-blue dark:text-secondary-dark">
              {prediction.predicted_home_score}:{prediction.predicted_away_score}
            </span>
            {prediction.points !== null && prediction.points !== undefined && (
              <span className="text-[10px] bg-primary-blue text-white px-1.5 py-0.5 rounded-md font-bold">
                +{prediction.points}
              </span>
            )}
          </div>
        )}

        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
          {kickoff.toLocaleString('cs-CZ', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <div className="flex items-center justify-center gap-4 mb-5">
        <div className="flex items-center gap-3 flex-1 justify-end">
          <span className="text-sm font-semibold text-text-primary dark:text-white text-right">{getCzechName(match.home_team_name)}</span>
          <TeamFlag teamName={match.home_team_name} size={40} />
        </div>

        <span className="text-sm font-bold text-gray-400 dark:text-gray-500 px-2">VS</span>

        <div className="flex items-center gap-3 flex-1 justify-start">
          <TeamFlag teamName={match.away_team_name} size={40} />
          <span className="text-sm font-semibold text-text-primary dark:text-white">{getCzechName(match.away_team_name)}</span>
        </div>
      </div>

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
            Uzavřeno
          </div>
        )}
      </div>
    </div>
  )
}