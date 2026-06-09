import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || ''
const API_FOOTBALL_HOST = 'v3.football.api-sports.io'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!API_FOOTBALL_KEY) {
    return NextResponse.json({ 
      error: 'API_FOOTBALL_KEY není nastaven. Přidej ho do .env.local nebo Vercel Environment Variables.' 
    }, { status: 500 })
  }

  const { tournamentId } = await request.json()
  if (!tournamentId) return NextResponse.json({ error: 'No tournament ID' }, { status: 400 })

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .neq('status', 'finished')
    .order('kickoff_at', { ascending: true })

  if (!matches || matches.length === 0) {
    return NextResponse.json({ error: 'Žádné nedokončené zápasy' }, { status: 400 })
  }

  const results: any[] = []
  const errors: string[] = []

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
        throw new Error(`API HTTP ${res.status}`)
      }

      const data = await res.json()
      const fixtures = data.response || []

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
        results.push({
          match_id: match.id,
          home_team_name: match.home_team_name,
          away_team_name: match.away_team_name,
          kickoff_at: match.kickoff_at,
          home_score: parseInt(fulltime.home),
          away_score: parseInt(fulltime.away),
          source: 'api-football',
          fixture_id: found.fixture.id
        })
      } else if (found) {
        results.push({
          match_id: match.id,
          home_team_name: match.home_team_name,
          away_team_name: match.away_team_name,
          kickoff_at: match.kickoff_at,
          home_score: null,
          away_score: null,
          source: 'not_finished',
          status: found.fixture.status.short
        })
      } else {
        results.push({
          match_id: match.id,
          home_team_name: match.home_team_name,
          away_team_name: match.away_team_name,
          kickoff_at: match.kickoff_at,
          home_score: null,
          away_score: null,
          source: 'not_found'
        })
      }
    } catch (err: any) {
      errors.push(`${match.home_team_name} vs ${match.away_team_name}: ${err.message}`)
      results.push({
        match_id: match.id,
        home_team_name: match.home_team_name,
        away_team_name: match.away_team_name,
        kickoff_at: match.kickoff_at,
        home_score: null,
        away_score: null,
        source: 'error'
      })
    }
  }

  return NextResponse.json({ 
    success: true, 
    results,
    errors: errors.length > 0 ? errors : undefined
  })
}