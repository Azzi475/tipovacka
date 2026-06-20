import { createServiceRoleClient } from '@/lib/supabase/service-role'

interface PredictionRow {
  id: string
  predicted_home_score: number
  predicted_away_score: number
}

export async function evaluateMatch(
  _supabase: unknown,
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<{ evaluated: number; matchUpdated: boolean; predictionErrors?: string[] }> {
  // Použij service role klienta, aby vyhodnocení fungovalo i z cronu bez přihlášeného uživatele
  const supabase = createServiceRoleClient()

  // 1. Uložení výsledku do matches
  const { data: updatedMatch, error: matchError } = await supabase
    .from('matches')
    .update({
      home_score_regular: homeScore,
      away_score_regular: awayScore,
      status: 'finished'
    })
    .eq('id', matchId)
    .select('id, home_score_regular, away_score_regular, status')
    .single()

  if (matchError) {
    throw new Error(`Chyba při ukládání výsledku zápasu: ${matchError.message}`)
  }

  if (!updatedMatch || updatedMatch.status !== 'finished') {
    throw new Error(`Zápas ${matchId} nebyl aktualizován na finished`)
  }

  // 2. Načtení tipů pro tento zápas
  const { data: predictions, error: predError } = await supabase
    .from('predictions')
    .select('id, predicted_home_score, predicted_away_score')
    .eq('match_id', matchId)
    .returns<PredictionRow[]>()

  if (predError) {
    throw new Error(`Chyba při načítání tipů: ${predError.message}`)
  }

  if (!predictions || predictions.length === 0) {
    return { evaluated: 0, matchUpdated: true }
  }

  // 3. Bodovací logika
  const exactHits = predictions.filter(
    (p) => p.predicted_home_score === homeScore && p.predicted_away_score === awayScore
  )
  const exactCount = exactHits.length
  const actualWinner =
    homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw'

  const updates = predictions.map((pred) => {
    let points = 0
    let exactHit = false
    let winnerOrDrawHit = false
    let uniqueExact = false

    if (
      pred.predicted_home_score === homeScore &&
      pred.predicted_away_score === awayScore
    ) {
      exactHit = true
      uniqueExact = exactCount === 1
      points = uniqueExact ? 3 : 2
      winnerOrDrawHit = true
    } else {
      const predictedWinner =
        pred.predicted_home_score > pred.predicted_away_score
          ? 'home'
          : pred.predicted_away_score > pred.predicted_home_score
            ? 'away'
            : 'draw'

      if (predictedWinner === actualWinner) {
        winnerOrDrawHit = true
        points = 1
      }
    }

    return {
      id: pred.id,
      points,
      exact_hit: exactHit,
      winner_or_draw_hit: winnerOrDrawHit,
      unique_exact: uniqueExact
    }
  })

  // 4. Hromadná aktualizace tipů
  const predictionErrors: string[] = []
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('predictions')
      .update({
        points: update.points,
        exact_hit: update.exact_hit,
        winner_or_draw_hit: update.winner_or_draw_hit,
        unique_exact: update.unique_exact
      })
      .eq('id', update.id)

    if (updateError) {
      predictionErrors.push(`${update.id}: ${updateError.message}`)
      console.error('Prediction update error:', updateError)
    }
  }

  if (predictionErrors.length > 0) {
    throw new Error(`Chyby při ukládání bodů: ${predictionErrors.join('; ')}`)
  }

  return { evaluated: predictions.length, matchUpdated: true }
}
