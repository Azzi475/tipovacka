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
  const url = 'https://worldcup26.ir/get/games'
  const maxRetries = 3
  const timeoutMs = 30000
  let lastError: unknown

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
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
      lastError = err
      if (attempt < maxRetries) {
        // Počkej před dalším pokusem (1s, 2s)
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
      }
    }
  }

  throw lastError
}

function parseOptionalScore(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = parseInt(String(value), 10)
  return isNaN(parsed) ? null : parsed
}
