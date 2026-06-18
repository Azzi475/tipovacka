import { createClient } from '@/lib/supabase/server'
import { evaluateMatch } from '@/lib/matches/evaluate'
import { fetchWorldCup26Fixtures, WorldCup26Fixture } from '@/lib/matches/providers/worldcup26'
import { getFlagCode, teamFlags } from '@/lib/flags'
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

  // Cron kontroluje nastavené časy, aby fetch proběhl jen v požadovaných hodinách
  return handleFetch('cron', true)
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

  // Manuální spuštění ignoruje časové omezení
  return handleFetch('manual', false)
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

function teamNameMatches(apiName: string, dbName: string): boolean {
  const a = apiName.trim().toLowerCase()
  const b = dbName.trim().toLowerCase()

  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  if (a.length >= 4 && b.length >= 4) {
    if (a.includes(b.slice(0, 4)) || b.includes(a.slice(0, 4))) return true
  }

  // Porovnání podle flag code (pouze pokud obě jména máme v mapě)
  const flagA = getFlagCode(apiName)
  const flagB = getFlagCode(dbName)
  const knownA = apiName in teamFlags
  const knownB = dbName in teamFlags
  if (knownA && knownB && flagA === flagB) return true

  return false
}

async function handleFetch(triggeredBy: 'cron' | 'manual', checkTime: boolean = false) {
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
    // Cron kontroluje nastavené časy, pokud není zvolen režim "každých 15 minut" (*)
    if (checkTime && tournament.auto_fetch_times && tournament.auto_fetch_times.trim() !== '*') {
      const fetchTimes = tournament.auto_fetch_times
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean)

      const now = new Date()
      const czTime = now.toLocaleTimeString('cs-CZ', {
        timeZone: 'Europe/Prague',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })

      if (fetchTimes.length > 0 && !fetchTimes.includes(czTime)) {
        results.push({
          tournament: tournament.name,
          sport: tournament.api_sport_type || 'football',
          skipped: `Není čas (${czTime})`
        })
        continue
      }
    }

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

      // MS 2026 provider se pozná podle kombinace football + api_league_id = 999999
      // (Supabase sloupec api_sport_type nemusí podporovat novou hodnotu football_wc26)
      const isWorldCup26 = sport === 'football' && tournament.api_league_id === 999999
      let worldCup26Fixtures: WorldCup26Fixture[] = []
      const apiItemsByDate: Record<string, ApiFixture[]> = {}

      if (isWorldCup26) {
        // Bezplatné API pro MS 2026 — vrací všechny zápasy turnaje v jednom requestu
        try {
          worldCup26Fixtures = await fetchWorldCup26Fixtures()
          apiCalls++
          debug.provider = 'worldcup26'
          debug.fixturesCount = worldCup26Fixtures.length
          debug.finishedCount = worldCup26Fixtures.filter((f) => f.finished).length
        } catch (err: unknown) {
          const detail = err instanceof Error ? err.message : 'Neznámá chyba'
          errorMessage = `WorldCup26 API selhalo: ${detail}`
          debug.providerError = detail
          debug.providerErrorStack = err instanceof Error ? err.stack : null
        }
      } else {
        // API-Football / Hockey: date-based volání (free plan nepodporuje league/season pro MS 2026)
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
          apiItemsByDate[dateStr] = items
          dateErrors.push(...apiErrors)
          debug[`date_${dateStr}`] = { url: searchUrl, resultCount, errors: apiErrors, preview: rawPreview }
        }

        if (dateErrors.length > 0) {
          errorMessage = `API chyba: ${dateErrors.join(', ')}`
        }

        debug.datesChecked = Array.from(dates)
      }

      debug.unfinishedMatches = matches.length

      // Projdi naše zápasy a najdi odpovídající záznam z API
      for (const match of matches) {
        try {
          let isFinished = false
          let homeScore: number | null = null
          let awayScore: number | null = null

          if (isWorldCup26) {
            const found = worldCup26Fixtures.find((f: WorldCup26Fixture) => {
              // Ve skupinové fázi je každá dvojice týmů unikátní.
              // API vrací místní datum, DB má časy v jiném pásmu, proto porovnáváme jen týmy.
              return (
                teamNameMatches(f.home, match.home_team_name) &&
                teamNameMatches(f.away, match.away_team_name)
              )
            })

            if (!found) {
              notFound++
              debug.notFoundList = debug.notFoundList || []
              ;(debug.notFoundList as string[]).push(`${match.home_team_name} vs ${match.away_team_name}`)
              continue
            }

            isFinished = found.finished
            homeScore = found.homeScore
            awayScore = found.awayScore
            debug.lastMatched = { home: found.home, away: found.away, finished: found.finished, score: `${homeScore}:${awayScore}` }
          } else {
            const kickoff = new Date(match.kickoff_at)
            const dateStr = kickoff.toISOString().split('T')[0]
            const apiItems = apiItemsByDate[dateStr] || []

            const found = apiItems.find((f: ApiFixture) => {
              return (
                teamNameMatches(f.teams.home.name, match.home_team_name) &&
                teamNameMatches(f.teams.away.name, match.away_team_name)
              )
            })

            if (!found) {
              notFound++
              continue
            }

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
