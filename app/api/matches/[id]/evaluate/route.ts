import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Role check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Zpracování params
  const params = await context.params
  const matchId = params.id

  // 4. Načtení dat z requestu
  const { home_score, away_score } = await request.json()

  if (typeof home_score !== 'number' || typeof away_score !== 'number') {
    return NextResponse.json({ error: 'Invalid scores' }, { status: 400 })
  }

  // 5. Uložení výsledku do matches
  const { error: matchError } = await supabase.from('matches').update({ 
    home_score_regular: home_score, 
    away_score_regular: away_score, 
    status: 'finished' 
  }).eq('id', matchId)

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 })
  }

  // 6. Načtení tipů pro tento zápas
  const { data: predictions } = await supabase.from('predictions').select('*').eq('match_id', matchId)

  if (!predictions || predictions.length === 0) {
    return NextResponse.json({ success: true, evaluated: 0 })
  }

  // 7. Bodovací logika
  const exactHits = predictions.filter(p => 
    p.predicted_home_score === home_score && p.predicted_away_score === away_score
  )
  const exactCount = exactHits.length
  const actualWinner = home_score > away_score ? 'home' : away_score > home_score ? 'away' : 'draw'

  for (const pred of predictions) {
    let points = 0
    let exactHit = false
    let winnerOrDrawHit = false
    let uniqueExact = false

    if (pred.predicted_home_score === home_score && pred.predicted_away_score === away_score) {
      exactHit = true
      uniqueExact = exactCount === 1
      points = uniqueExact ? 3 : 2
    } else {
      const predictedWinner = pred.predicted_home_score > pred.predicted_away_score ? 'home' : 
                             pred.predicted_away_score > pred.predicted_home_score ? 'away' : 'draw'
      if (predictedWinner === actualWinner) {
        winnerOrDrawHit = true
        points = 1
      }
    }

    const { error: updateError } = await supabase.from('predictions').update({
      points,
      exact_hit: exactHit,
      winner_or_draw_hit: winnerOrDrawHit,
      unique_exact: uniqueExact
    }).eq('id', pred.id)

    if (updateError) {
      console.error('Prediction update error:', updateError)
    }
  }

  return NextResponse.json({ success: true, evaluated: predictions.length })
}