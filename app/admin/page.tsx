'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Match = {
  id: string
  home_team_name: string
  away_team_name: string
  kickoff_at: string
  status: string
  home_score_regular: number | null
  away_score_regular: number | null
}

export default function AdminPage() {
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'matches' | 'leaderboard'>('matches')
  const [message, setMessage] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setIsAdmin(false); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setIsAdmin(profile?.role === 'admin')
      if (profile?.role === 'admin') loadData()
    }
    check()
  }, [supabase])

  async function loadData() {
    const { data: tournament } = await supabase.from('tournaments').select('id').eq('is_active', true).single()
    if (tournament) {
      const { data } = await supabase.from('matches').select('*').eq('tournament_id', tournament.id).order('kickoff_at', { ascending: true })
      setMatches(data || [])
    }
    await loadLeaderboard()
  }

  async function loadLeaderboard() {
    const { data: preds } = await supabase.from('predictions').select('user_id, points, exact_hit').not('points', 'is', null)
    const { data: profs } = await supabase.from('profiles').select('id, nickname, first_name, last_name')

    if (!preds || !profs) { setLeaderboard([]); return }

    const profileMap: Record<string, any> = {}
    profs.forEach((p: any) => profileMap[p.id] = p)

    const grouped: Record<string, any> = {}
    preds.forEach((row: any) => {
      if (!grouped[row.user_id]) grouped[row.user_id] = { user_id: row.user_id, profile: profileMap[row.user_id], points: 0, exact: 0 }
      grouped[row.user_id].points += (row.points || 0)
      if (row.exact_hit) grouped[row.user_id].exact += 1
    })

    setLeaderboard(Object.values(grouped).sort((a: any, b: any) => b.points - a.points || b.exact - a.exact))
  }

  async function deleteMatch(id: string) {
    const res = await fetch(`/api/matches/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) {
      setMessage('Zápas smazán')
      setDeleteConfirm(null)
      loadData()
    } else {
      setMessage('Chyba mazání: ' + (data.error || 'Neznámá chyba'))
    }
  }

  if (isAdmin === null) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-pulse text-slate-500">Načítání...</div>
    </div>
  )
  
  if (isAdmin === false) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold mb-2 text-slate-800">Přístup odepřen</h1>
        <p className="text-slate-500 mb-6">Tato sekce je pouze pro administrátory.</p>
        <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">Zpět na úvod</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-slate-900 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex gap-6 items-center">
          <span className="font-bold text-lg tracking-tight">⚡ Tipovačka Admin</span>
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
            <button onClick={() => setActiveTab('matches')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'matches' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}>Zápasy</button>
            <button onClick={() => { setActiveTab('leaderboard'); loadLeaderboard() }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'leaderboard' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}>Leaderboard</button>
          </div>
          <div className="ml-auto flex gap-4 items-center">
            <Link href="/dashboard" className="text-sm text-slate-300 hover:text-white transition">Hráčská sekce</Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-md transition">Odhlásit se</button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {message && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm font-medium animate-fade-in">
            {message}
          </div>
        )}

        {activeTab === 'matches' ? (
          <MatchesTab matches={matches} onRefresh={loadData} setMessage={setMessage} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm} onDelete={deleteMatch} />
        ) : (
          <LeaderboardTab leaderboard={leaderboard} />
        )}
      </main>
    </div>
  )
}

function MatchesTab({ matches, onRefresh, setMessage, deleteConfirm, setDeleteConfirm, onDelete }: any) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setImporting(true)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/matches/import', { method: 'POST', body: formData })
    const data = await res.json()
    setImporting(false)
    if (data.success) { setMessage(`Importováno ${data.count} zápasů`); onRefresh(); setFile(null) }
    else setMessage('Chyba importu: ' + (data.error || 'Neznámá chyba'))
  }

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Import zápasů</h2>
        <p className="text-sm text-slate-500 mb-4">Nahraj CSV soubor se zápasy pro aktivní turnaj.</p>
        <form onSubmit={handleImport} className="flex gap-3 items-end">
          <div className="flex-1">
            <input type="file" accept=".csv" required onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
          </div>
          <button type="submit" disabled={importing} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed">
            {importing ? 'Importuji...' : 'Importovat'}
          </button>
        </form>
      </div>

      <div className="grid gap-4">
        {matches.length === 0 && (
          <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed">
            <p className="text-lg mb-1">Žádné zápasy</p>
            <p className="text-sm">Nahraj CSV soubor pro import zápasů.</p>
          </div>
        )}
        {matches.map((m: Match) => (
          <MatchCard key={m.id} match={m} onRefresh={onRefresh} setMessage={setMessage} isDeleting={deleteConfirm === m.id} onConfirmDelete={() => setDeleteConfirm(m.id)} onDelete={() => onDelete(m.id)} onCancelDelete={() => setDeleteConfirm(null)} />
        ))}
      </div>
    </div>
  )
}

function MatchCard({ match, onRefresh, setMessage, isDeleting, onConfirmDelete, onDelete, onCancelDelete }: any) {
  const [home, setHome] = useState(match.home_score_regular ?? '')
  const [away, setAway] = useState(match.away_score_regular ?? '')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setHome(match.home_score_regular ?? '')
    setAway(match.away_score_regular ?? '')
    setEditing(false)
  }, [match.home_score_regular, match.away_score_regular, match.status])

  const saveResult = async () => {
    setSaving(true)
    const res = await fetch(`/api/matches/${match.id}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ home_score: Number(home), away_score: Number(away) })
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) { setMessage('Výsledek uložen a body přepočítány'); setEditing(false); onRefresh() }
    else setMessage('Chyba: ' + (data.error || 'Neznámá chyba'))
  }

  const isFinished = match.status === 'finished'
  const isLocked = new Date(match.kickoff_at) <= new Date()

  const statusConfig: Record<string, { text: string; color: string; bg: string }> = {
    scheduled: { text: isLocked ? '🔴 Už začal' : '🟡 Naplánováno', color: 'text-amber-700', bg: 'bg-amber-50' },
    live: { text: '🔴 Živě', color: 'text-red-700', bg: 'bg-red-50' },
    finished: { text: '✅ Dokončeno', color: 'text-emerald-700', bg: 'bg-emerald-50' },
    postponed: { text: '⏸ Odloženo', color: 'text-slate-700', bg: 'bg-slate-100' }
  }

  const status = statusConfig[match.status] || statusConfig.scheduled

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}>{status.text}</span>
            <span className="text-xs text-slate-400">{new Date(match.kickoff_at).toLocaleString('cs-CZ')}</span>
          </div>
          <div className="flex items-center gap-3 text-lg font-bold text-slate-800">
            <span className="text-slate-900">{match.home_team_name}</span>
            <span className="text-slate-300">vs</span>
            <span className="text-slate-900">{match.away_team_name}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(!isFinished || editing) ? (
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
              <input type="number" min={0} className="w-14 p-1.5 border rounded-md text-center font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" value={home} onChange={e => setHome(e.target.value)} />
              <span className="text-slate-400 font-bold">:</span>
              <input type="number" min={0} className="w-14 p-1.5 border rounded-md text-center font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" value={away} onChange={e => setAway(e.target.value)} />
            </div>
          ) : (
            <div className="text-2xl font-black text-emerald-600 tabular-nums">
              {match.home_score_regular} : {match.away_score_regular}
            </div>
          )}

          {(!isFinished || editing) && (
            <button onClick={saveResult} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">
              {saving ? '...' : 'Uložit'}
            </button>
          )}

          {isFinished && !editing && (
            <button onClick={() => setEditing(true)} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition" title="Opravit výsledek">
              ✏️
            </button>
          )}

          {isDeleting ? (
            <div className="flex gap-2">
              <button onClick={onDelete} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition">Smazat</button>
              <button onClick={onCancelDelete} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition">Zrušit</button>
            </div>
          ) : (
            <button onClick={onConfirmDelete} className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition" title="Smazat zápas">🗑️</button>
          )}
        </div>
      </div>
    </div>
  )
}

function LeaderboardTab({ leaderboard }: { leaderboard: any[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">Leaderboard</h2>
        <p className="text-sm text-slate-500 mt-1">Pořadí hráčů podle bodů a přesných tipů.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Pořadí</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Hráč</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Body</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Přesné tipy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leaderboard.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">Zatím žádná data. Zadej výsledky zápasů pro zobrazení pořadí.</td></tr>
            )}
            {leaderboard.map((row, idx) => (
              <tr key={row.user_id} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-slate-200 text-slate-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                    {idx + 1}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-slate-800">{row.profile?.nickname || 'Neznámý'}</div>
                  <div className="text-xs text-slate-500">{row.profile?.first_name} {row.profile?.last_name}</div>
                </td>
                <td className="px-6 py-4 font-bold text-slate-800 text-lg">{row.points}</td>
                <td className="px-6 py-4 text-slate-600">{row.exact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}