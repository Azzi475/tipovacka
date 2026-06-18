export interface WorldCup26Fixture {
  id: string
  home: string
  away: string
  homeScore: number | null
  awayScore: number | null
  finished: boolean
  date: string
}

export async function fetchWorldCup26Fixtures(): Promise<WorldCup26Fixture[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch('https://worldcup26.ir/get/games', {
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      throw new Error(`WorldCup26 API HTTP ${res.status}`)
    }

    const data = await res.json()
    const games = data?.games || []

    return games.map((g: any) => ({
      id: String(g.id),
      home: String(g.home_team_name_en || '').trim(),
      away: String(g.away_team_name_en || '').trim(),
      homeScore: parseOptionalScore(g.home_score),
      awayScore: parseOptionalScore(g.away_score),
      finished:
        String(g.finished).toUpperCase() === 'TRUE' ||
        String(g.time_elapsed).toLowerCase() === 'finished',
      date: String(g.local_date || ''),
    }))
  } catch (err) {
    clearTimeout(timeout)
    throw err
  }
}

function parseOptionalScore(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = parseInt(String(value), 10)
  return isNaN(parsed) ? null : parsed
}
