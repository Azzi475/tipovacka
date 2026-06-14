import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || ''

export async function GET(request: Request) {
  const supabase = await createClient()

  // Aktuální čas v ČR
  const now = new Date()
  const czTime = now.toLocaleTimeString('cs-CZ', {
    timeZone: 'Europe/Prague',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  if (!API_FOOTBALL_KEY) {
    return NextResponse.json({ error: 'API_FOOTBALL_KEY není nastaven' }, { status: 500 })
  }

  // Najdi aktivní turnaje s auto-fetch zapnutým
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .eq('is_active', true)
    .eq('auto_fetch_enabled', true)

  if (!tournaments || tournaments.length === 0) {
    return NextResponse.json({ message: 'Žádný aktivní turnaj s auto-fetch' })
  }

  const results: any[] = []

  for (const tournament of tournaments) {
    // Parsovat časy z DB (např. "23:15, 06:30")
    const fetchTimes = (tournament.auto_fetch_times || '23:15, 06:30')
      .split(',')
      .map((t: string) => t.trim())

    // Je aktuální čas v nastavených časech?
    if (!fetchTimes.includes(czTime)) {
      results.push({ tournament: tournament.name, skipped: `Není čas (${czTime})` })
      continue
    }

    // Najdi nedokončené zápasy
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournament.id)
      .neq('status', 'finished')
      .order('kickoff_at', { ascending: true })

    if (!matches || matches.length === 0) {
      results.push({ tournament: tournament.name, skipped: 'Žádné nedokončené zápasy' })
      continue
    }

    const sport = tournament.api_sport_type || 'football'
    const isHockey = sport === 'ice_hockey'
    const apiHost = isHockey ? 'v1.hockey.api-sports.io' : 'v3.football.api-sports.io'
    const endpoint = isHockey ? 'games' : 'fixtures'

    let updated = 0
    let notFound = 0

    for (const match of matches) {
      try {
        const kickoff = new Date(match.kickoff_at)
        const dateStr = kickoff.toISOString().split('T')[0]

        const searchUrl = `https://${apiHost}/${endpoint}?date=${dateStr}`

        const res = await fetch(searchUrl, {
          headers: {
            'x-rapidapi-key': API_FOOTBALL_KEY,
            'x-rapidapi-host': apiHost,
          },
        })

        if (!res.ok) {
          console.error(`API HTTP ${res.status} pro ${match.home_team_name} vs ${match.away_team_name}`)
          continue
        }

        const data = await res.json()
        const items = data.response || []

        // Najdi zápas podle jmen týmů
        const found = items.find((f: any) => {
          const home = f.teams.home.name.toLowerCase()
          const away = f.teams.away.name.toLowerCase()
          const matchHome = match.home_team_name.toLowerCase()
          const matchAway = match.away_team_name.toLowerCase()

          return (
            (home.includes(matchHome) || matchHome.includes(home) || home.includes(matchHome.slice(0, 4))) &&
            (away.includes(matchAway) || matchAway.includes(away) || away.includes(matchAway.slice(0, 4)))
          )
        })

        if (!found) {
          notFound++
          continue
        }

        // Zjisti, jestli je zápas dokončený
        let isFinished = false
        let homeScore: number | null = null
        let awayScore: number | null = null

        if (isHockey) {
          // Hokej: FT, OT, SO = dokončeno
          const status = found.status?.short
          isFinished = status === 'FT' || status === 'OT' || status === 'SO'
          if (isFinished && found.scores) {
            homeScore = parseInt(found.scores.home)
            awayScore = parseInt(found.scores.away)
          }
        } else {
          // Fotbal: FT = základní hrací doba (90 min)
          isFinished = found.fixture.status.short === 'FT'
          if (isFinished && found.score?.fulltime) {
            homeScore = parseInt(found.score.fulltime.home)
            awayScore = parseInt(found.score.fulltime.away)
          }
        }

        if (isFinished && homeScore !== null && awayScore !== null) {
          // === ROVNOU VYHODNOŤ ZÁPAS ===
          // 1. Ulož skóre
          await supabase
            .from('matches')
            .update({
              home_score_regular: homeScore,
              away_score_regular: awayScore,
              status: 'finished'
            })
            .eq('id', match.id)

          // 2. Přepočti body pro tipy
          const { data: predictions } = await supabase
            .from('predictions')
            .select('*')
            .eq('match_id', match.id)

          if (predictions && predictions.length > 0) {
            const exactHits = predictions.filter(
              (p: any) => p.predicted_home_score === homeScore && p.predicted_away_score === awayScore
            ).length

            let actualWinner = 'draw'
            if (homeScore > awayScore) actualWinner = 'home'
            else if (awayScore > homeScore) actualWinner = 'away'

            for (const pred of predictions) {
              let predictedWinner = 'draw'
              if (pred.predicted_home_score > pred.predicted_away_score) predictedWinner = 'home'
              else if (pred.predicted_away_score > pred.predicted_home_score) predictedWinner = 'away'

              let points = 0
              let exact = false
              let winner = false
              let unique = false

              if (pred.predicted_home_score === homeScore && pred.predicted_away_score === awayScore) {
                exact = true
                winner = true
                points = exactHits === 1 ? 3 : 2
                unique = exactHits === 1
              } else if (predictedWinner === actualWinner) {
                points = 1
                winner = true
              }

              await supabase
                .from('predictions')
                .update({
                  points: points,
                  exact_hit: exact,
                  winner_or_draw_hit: winner,
                  unique_exact: unique
                })
                .eq('id', pred.id)
            }
          }

          updated++
        }
      } catch (err: any) {
        console.error(`Chyba u zápasu ${match.id}:`, err.message)
      }
    }

    results.push({
      tournament: tournament.name,
      sport,
      updated,
      notFound,
      totalMatches: matches.length,
      currentTime: czTime
    })
  }

  return NextResponse.json({ success: true, results })
}

// POST pro manuální spuštění adminem
export async function POST(request: Request) {
  return GET(request)
}