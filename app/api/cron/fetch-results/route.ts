import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || ''
const API_FOOTBALL_HOST = 'v3.football.api-sports.io'

// Časy natvrdo: 23:15 a 06:30 (Český čas)
const FETCH_TIMES = ['23:15', '06:30']

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

  // Je aktuální čas v seznamu?
  if (!FETCH_TIMES.includes(czTime)) {
    return NextResponse.json({ message: 'Není čas načítání', currentTime: czTime })
  }

  if (!API_FOOTBALL_KEY) {
    return NextResponse.json({ error: 'API_FOOTBALL_KEY není nastaven' }, { status: 500 })
  }

  // Najdi aktivní turnaje
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .eq('is_active', true)

  if (!tournaments || tournaments.length === 0) {
    return NextResponse.json({ message: 'Žádný aktivní turnaj' })
  }

  const results: any[] = []

  for (const tournament of tournaments) {
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

    let updated = 0
    let notFound = 0

    for (const match of matches) {
      try {
        const kickoff = new Date(match.kickoff_at)
        const dateStr = kickoff.toISOString().split('T')[0]

        const searchUrl = `https://${API_FOOTBALL_HOST}/fixtures?date=${dateStr}`

        const res = await fetch(searchUrl, {
          headers: {
            'x-rapidapi-key': API_FOOTBALL_KEY,
            'x-rapidapi-host': API_FOOTBALL_HOST,
          },
        })

        if (!res.ok) {
          console.error(`API HTTP ${res.status} pro ${match.home_team_name} vs ${match.away_team_name}`)
          continue
        }

        const data = await res.json()
        const fixtures = data.response || []

        // Najdi zápas podle jmen týmů
        const found = fixtures.find((f: any) => {
          const home = f.teams.home.name.toLowerCase()
          const away = f.teams.away.name.toLowerCase()
          const matchHome = match.home_team_name.toLowerCase()
          const matchAway = match.away_team_name.toLowerCase()

          return (
            (home.includes(matchHome) || matchHome.includes(home) || home.includes(matchHome.slice(0, 4))) &&
            (away.includes(matchAway) || matchAway.includes(away) || away.includes(matchAway.slice(0, 4)))
          )
        })

        if (found && found.fixture.status.short === 'FT') {
          const fulltime = found.score.fulltime
          const homeScore = parseInt(fulltime.home)
          const awayScore = parseInt(fulltime.away)

          // === ROVNOU VYHODNOŤ ZÁPAS (bez čekání na admina) ===
          // 1. Ulož skóre
          const { error: updateError } = await supabase
            .from('matches')
            .update({
              home_score_regular: homeScore,
              away_score_regular: awayScore,
              status: 'finished'
            })
            .eq('id', match.id)

          if (updateError) {
            console.error('Chyba uložení skóre:', updateError)
            continue
          }

          // 2. Přepočti body pro tipy
          const { data: predictions } = await supabase
            .from('predictions')
            .select('*')
            .eq('match_id', match.id)

          if (predictions && predictions.length > 0) {
            // Spočti přesné tipy
            const exactHits = predictions.filter(
              (p: any) => p.predicted_home_score === homeScore && p.predicted_away_score === awayScore
            ).length

            // Urči vítěze
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
        } else if (found) {
          notFound++
        } else {
          notFound++
        }
      } catch (err: any) {
        console.error(`Chyba u zápasu ${match.id}:`, err.message)
      }
    }

    results.push({
      tournament: tournament.name,
      updated,
      notFound,
      totalMatches: matches.length
    })
  }

  return NextResponse.json({ success: true, currentTime: czTime, results })
}

// POST pro manuální spuštění
export async function POST(request: Request) {
  return GET(request)
}