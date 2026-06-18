import { createClient } from '@/lib/supabase/server'
import { evaluateMatch } from '@/lib/matches/evaluate'
import { NextResponse } from 'next/server'

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || ''
const CRON_SECRET = process.env.CRON_SECRET || ''

interface ApiFixture {
  teams: {
    home: { name: string }
    away: { name: string }
  }
  fixture?: {
    status: { short: string }
  }
  status?: {
    short: string
  }
  score?: {
    fulltime?: {
      home: string | number
      away: string | number
    }
  }
  scores?: {
    home: string | number
    away: string | number
  }
}

interface FetchResult {
  tournament: string
  sport: string
  updated?: number
  notFound?: number
  apiCalls?: number
  skipped?: string
  error?: string | null
  debug?: Record<string, unknown>
}

export async function GET(_request: Request) {
  // Cron-job.org musí poslat CRON_SECRET v Authorization headeru
  const authHeader = _request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET není nastaven' }, { status: 500 })
  }

  if (token !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return handleFetch('cron')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: Request) {
  const supabase = await createClient()

  // Manuální spuštění vyžaduje přihlášeného admina
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return handleFetch('manual')
}

async function fetchFromApi(searchUrl: string, apiHost: string) {
  const res = await fetch(searchUrl, {
    headers: {
      'x-apisports-key': API_FOOTBALL_KEY,
      'x-rapidapi-key': API_FOOTBALL_KEY,
      'x-rapidapi-host': apiHost,
    },
  })

  const data = await res.json()
  const apiErrors: string[] = []

  if (!res.ok) {
    apiErrors.push(`HTTP ${res.status}`)
  }

  if (data && typeof data === 'object') {
    if (data.errors && typeof data.errors === 'object' && Object.keys(data.errors).length > 0) {
      for (const [key, value] of Object.entries(data.errors)) {
        apiErrors.push(`${key}: ${value}`)
      }
    }
  }

  const items: ApiFixture[] = data?.response || []
  const resultCount = typeof data?.results === 'number' ? data.results : items.length
  const rawPreview = items.slice(0, 2).map((f: ApiFixture) => ({
    status: isHockeyFixture(f) ? f.status?.short : f.fixture?.status?.short,
    home: f.teams?.home?.name,
    away: f.teams?.away?.name,
    score: isHockeyFixture(f) ? f.scores : f.score?.fulltime,
  }))

  return {
    items,
    calls: 1,
    apiErrors,
    resultCount,
    rawPreview,
  }
}

function isHockeyFixture(f: ApiFixture): boolean {
  return 'scores' in f && f.scores !== undefined
}

async function handleFetch(triggeredBy: 'cron' | 'manual') {
  const supabase = await createClient()

  if (!API_FOOTBALL_KEY) {
    return NextResponse.json({ error: 'API_FOOTBALL_KEY není nastaven' }, { status: 500 })
  }

  // Najdi aktivní turnaje s auto-fetch zapnutým
  const { data: tournaments, error: tournamentsError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('is_active', true)
    .eq('auto_fetch_enabled', true)

  if (tournamentsError) {
    return NextResponse.json({ error: tournamentsError.message }, { status: 500 })
  }

  if (!tournaments || tournaments.length === 0) {
    return NextResponse.json({ message: 'Žádný aktivní turnaj s auto-fetch' })
  }

  const results: FetchResult[] = []

  for (const tournament of tournaments) {
    const logId = await insertFetchLog(supabase, tournament.id, triggeredBy)

    let updated = 0
    let notFound = 0
    let apiCalls = 0
    let errorMessage: string | null = null
    const debug: Record<string, unknown> = {}

    try {
      const sport = tournament.api_sport_type || 'football'
      const isHockey = sport === 'ice_hockey'
      const apiHost = isHockey ? 'v1.hockey.api-sports.io' : 'v3.football.api-sports.io'
      const endpoint = isHockey ? 'games' : 'fixtures'

      // Načti nedokončené zápasy turnaje
      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournament.id)
        .neq('status', 'finished')
        .order('kickoff_at', { ascending: true })

      if (!matches || matches.length === 0) {
        await finishFetchLog(supabase, logId, { apiCalls, matchesUpdated: 0, matchesNotFound: 0 })
        results.push({ tournament: tournament.name, sport, skipped: 'Žádné nedokončené zápasy' })
        continue
      }

      let apiItems: ApiFixture[] = []

      // Strategie: pokud máme league + season, stáhneme celý turnaj najednou
      if (tournament.api_league_id && tournament.api_season) {
        const searchUrl = `https://${apiHost}/${endpoint}?league=${tournament.api_league_id}&season=${tournament.api_season}`
        const { items, calls, apiErrors, resultCount, rawPreview } = await fetchFromApi(searchUrl, apiHost)
        apiCalls += calls
        apiItems = items
        debug.leagueSeasonUrl = searchUrl
        debug.leagueSeasonErrors = apiErrors
        debug.leagueSeasonResultCount = resultCount
        debug.leagueSeasonPreview = rawPreview

        if (apiErrors.length > 0) {
          errorMessage = `API chyba: ${apiErrors.join(', ')}`
        }
      }

      // Fallback na date-based, pokud league/season nevrátilo nic nebo nebylo nastaveno
      if (apiItems.length === 0) {
        const dates = new Set<string>()
        for (const match of matches) {
          const kickoff = new Date(match.kickoff_at)
          const dateStr = kickoff.toISOString().split('T')[0]
          dates.add(dateStr)
        }

        const dateErrors: string[] = []
        for (const dateStr of dates) {
          const searchUrl = `https://${apiHost}/${endpoint}?date=${dateStr}`
          const { items, calls, apiErrors, resultCount, rawPreview } = await fetchFromApi(searchUrl, apiHost)
          apiCalls += calls
          apiItems.push(...items)
          dateErrors.push(...apiErrors)
          debug[`date_${dateStr}`] = { url: searchUrl, resultCount, errors: apiErrors, preview: rawPreview }
        }

        if (dateErrors.length > 0 && !errorMessage) {
          errorMessage = `API chyba (date fallback): ${dateErrors.join(', ')}`
        }
      }

      debug.totalApiItems = apiItems.length
      debug.unfinishedMatches = matches.length

      // Projdi naše zápasy a najdi odpovídající záznam z API
      for (const match of matches) {
        try {
          const found = apiItems.find((f: ApiFixture) => {
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

          // Zjisti, jestli je zápas dokončený a načti skóre
          let isFinished = false
          let homeScore: number | null = null
          let awayScore: number | null = null

          if (isHockey) {
            const status = found.status?.short
            isFinished = status === 'FT' || status === 'OT' || status === 'SO'
            if (isFinished && found.scores) {
              homeScore = parseInt(String(found.scores.home))
              awayScore = parseInt(String(found.scores.away))
            }
          } else {
            isFinished = found.fixture?.status.short === 'FT'
            if (isFinished && found.score?.fulltime) {
              homeScore = parseInt(String(found.score.fulltime.home))
              awayScore = parseInt(String(found.score.fulltime.away))
            }
          }

          if (isFinished && homeScore !== null && awayScore !== null) {
            await evaluateMatch(supabase, match.id, homeScore, awayScore)
            updated++
          }
        } catch (err: unknown) {
          console.error(`Chyba u zápasu ${match.id}:`, err instanceof Error ? err.message : 'Neznámá chyba')
        }
      }
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : 'Neznámá chyba'
      console.error(`Chyba turnaje ${tournament.name}:`, errorMessage)
    }

    await finishFetchLog(supabase, logId, {
      apiCalls,
      matchesUpdated: updated,
      matchesNotFound: notFound,
      error: errorMessage
    })

    debug.updated = updated
    debug.notFound = notFound
    debug.error = errorMessage

    results.push({
      tournament: tournament.name,
      sport: tournament.api_sport_type || 'football',
      updated,
      notFound,
      apiCalls,
      error: errorMessage,
      debug
    })
  }

  return NextResponse.json({ success: true, results })
}

async function insertFetchLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tournamentId: string,
  triggeredBy: 'cron' | 'manual'
) {
  const { data, error } = await supabase
    .from('fetch_logs')
    .insert({
      tournament_id: tournamentId,
      triggered_by: triggeredBy,
      started_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error) {
    console.error('Chyba při zakládání fetch logu:', error)
    return null
  }

  return data.id
}

async function finishFetchLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  logId: string | null,
  payload: {
    apiCalls: number
    matchesUpdated: number
    matchesNotFound: number
    error?: string | null
  }
) {
  if (!logId) return

  await supabase
    .from('fetch_logs')
    .update({
      finished_at: new Date().toISOString(),
      api_calls: payload.apiCalls,
      matches_updated: payload.matchesUpdated,
      matches_not_found: payload.matchesNotFound,
      error: payload.error || null
    })
    .eq('id', logId)
}
