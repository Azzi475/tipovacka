import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  // Použij tournament_id z FormData, jinak fallback na aktivní turnaj
  const tournamentId = formData.get('tournament_id') as string
  let tournamentIdToUse = tournamentId

  if (!tournamentIdToUse) {
    const { data: tournament } = await supabase.from('tournaments').select('id').eq('is_active', true).single()
    if (!tournament) return NextResponse.json({ error: 'No active tournament and no tournament_id provided' }, { status: 400 })
    tournamentIdToUse = tournament.id
  }

  const text = await file.text()
  const lines = text.split('\n').filter(line => line.trim())
  if (lines.length < 2) return NextResponse.json({ error: 'Empty CSV' }, { status: 400 })

  const headers = lines[0].split(',').map(h => h.trim())
  const rows = lines.slice(1).map(line => {
    const cols = line.split(',')
    const obj: any = {}
    headers.forEach((h, i) => obj[h] = cols[i]?.trim())
    return obj
  })

  const matches = rows.map(r => ({
    tournament_id: tournamentIdToUse,
    home_team_name: r.home_team_name,
    away_team_name: r.away_team_name,
    kickoff_at: new Date(r.kickoff_at).toISOString(),
    status: 'scheduled'
  })).filter(m => m.home_team_name && m.away_team_name && m.kickoff_at)

  const { error: insertError } = await supabase.from('matches').insert(matches)
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ success: true, count: matches.length })
}