import { createClient } from '@/lib/supabase/server'
import { evaluateMatch } from '@/lib/matches/evaluate'
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

  // 5. Vyhodnocení zápasu přes sdílenou funkci
  try {
    const result = await evaluateMatch(supabase, matchId, home_score, away_score)
    return NextResponse.json({ success: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Neznámá chyba'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
