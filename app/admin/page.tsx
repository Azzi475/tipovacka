'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useTheme } from '@/components/theme-provider'
import { getFlagPath, getFlagCode } from '@/lib/flags'

type Match = {
  id: string
  home_team_name: string
  away_team_name: string
  kickoff_at: string
  status: string
  home_score_regular: number | null
  away_score_regular: number | null
}

type Tournament = {
  id: string
  name: string
  sport: string
  season_year: number
  status: string
  is_active: boolean
  leaderboard_closed: boolean
  leaderboard_message: string | null
}

function TeamFlag({ teamName, size = 24 }: { teamName: string; size?: number }) {
  const [error, setError] = useState(false)
  if (error) {
    const code = getFlagCode(teamName)
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600 text-xs font-bold text-gray-700 dark:text-gray-300" style={{ width: size, height: size }}>
        {code.toUpperCase()}
      </span>
    )
  }
  return (
    <Image src={getFlagPath(teamName)} alt={teamName} width={size} height={size} className="inline-block rounded-full object-cover" unoptimized={true} onError={() => setError(true)} />
  )
}

export default function AdminPage() {
  const supabase = createClient()
  const { theme, toggleTheme } = useTheme()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null)
  const [selectedTournament, setSelectedTournament] = useState<string>('')
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'matches' | 'leaderboard'>('matches')
  const [message, setMessage] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showNewTournament, setShowNewTournament] = useState(false)
  const [newMatch, setNewMatch] = useState({ home: '', away: '', date: '', time: '16:20' })
  const [newTournament, setNewTournament] = useState({ name: '', sport: 'ice_hockey', season_year: 2026 })
  const [leaderboardMsg, setLeaderboardMsg] = useState('')
  const [showFinished, setShowFinished] = useState(false)
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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
    const { data: t } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false })
    setTournaments(t || [])
    const active = t?.find((x: Tournament) => x.is_active)
    const tid = selectedTournament || active?.id || (t?.[0]?.id)
    if (tid && !selectedTournament) setSelectedTournament(tid)

    const current = t?.find((x: Tournament) => x.id === tid) || null
    setCurrentTournament(current)
    if (current?.leaderboard_message) setLeaderboardMsg(current.leaderboard_message)

    if (tid) {
      const { data } = await supabase.from('matches').select('*').eq('tournament_id', tid).order('kickoff_at', { ascending: true })
      setMatches(data || [])
    }
    await loadLeaderboard(tid)
  }

  async function loadLeaderboard(tournamentId?: string) {
    const tid = tournamentId || selectedTournament
    if (!tid) { setLeaderboard([]); return }

    setLoadingLeaderboard(true)
    try {
      const { data: leaderboardData, error: rpcError } = await supabase
        .rpc('get_leaderboard', { tournament_uuid: tid })

      if (rpcError || !leaderboardData) {
        console.error('RPC error:', rpcError)
        setMessage('Chyba při načítání žebříčku: ' + (rpcError?.message || 'Neznámá chyba'))
        setLeaderboard([])
        return
      }

      const { data: profs } = await supabase.from('profiles').select('id, nickname, first_name, last_name')

      const map: Record<string, any> = {}
      profs?.forEach((p: any) => map[p.id] = p)

      const enriched = leaderboardData.map((row: any) => ({
        user_id: row.user_id,
        points: Number(row.total_points),
        exact: Number(row.exact_count),
        unique: Number(row.unique_count),
        profile: map[row.user_id]
      }))

      setLeaderboard(enriched)
    } catch (err: any) {
      setMessage('Chyba při načítání žebříčku: ' + (err?.message || 'Neznámá chyba'))
    } finally {
      setLoadingLeaderboard(false)
    }
  }

  async function toggleLeaderboard() {
    if (!currentTournament) return
    const newClosed = !currentTournament.leaderboard_closed
    const { error } = await supabase
      .from('tournaments')
      .update({ 
        leaderboard_closed: newClosed, 
        leaderboard_message: leaderboardMsg || null 
      })
      .eq('id', currentTournament.id)

    if (error) {
      setMessage('Chyba: ' + error.message)
    } else {
      setMessage(newClosed ? 'Žebříček uzavřen pro hráče' : 'Žebříček otevřen pro hráče')
      setCurrentTournament({ ...currentTournament, leaderboard_closed: newClosed, leaderboard_message: leaderboardMsg })
    }
  }

  async function addMatch(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTournament || !newMatch.home || !newMatch.away || !newMatch.date) return
    const kickoff = new Date(`${newMatch.date}T${newMatch.time}:00`).toISOString()
    const { error } = await supabase.from('matches').insert({
      tournament_id: selectedTournament, home_team_name: newMatch.home, away_team_name: newMatch.away,
      kickoff_at: kickoff, status: 'scheduled'
    })
    if (error) setMessage('Chyba: ' + error.message)
    else { setMessage('Zápas přidán!'); setNewMatch({ home: '', away: '', date: '', time: '16:20' }); setShowAddForm(false); loadData() }
  }

  async function createTournament(e: React.FormEvent) {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('tournaments').insert({
      name: newTournament.name, sport: newTournament.sport, season_year: newTournament.season_year,
      status: 'draft', is_active: false, created_by: user?.id
    })
    if (error) setMessage('Chyba: ' + error.message)
    else { setMessage('Turnaj vytvořen!'); setShowNewTournament(false); setNewTournament({ name: '', sport: 'ice_hockey', season_year: 2026 }); loadData() }
  }

  async function activateTournament(id: string) {
    const { error } = await supabase.from('tournaments').update({ is_active: true, status: 'active' }).eq('id', id)
    if (!error) { setMessage('Turnaj aktivován'); loadData() }
  }

  async function finishTournament(id: string) {
    const { error } = await supabase.from('tournaments').update({ is_active: false, status: 'finished' }).eq('id', id)
    if (!error) { setMessage('Turnaj ukončen'); loadData() }
  }

  // OPRAVA: Smazání zápasu přes Supabase místo fetch API
  async function deleteMatch(id: string) {
    try {
      // 1. Nejprve smažeme všechny predikce pro tento zápas (kvůli foreign key)
      const { error: predError } = await supabase
        .from('predictions')
        .delete()
        .eq('match_id', id)

      if (predError) {
        console.error('Chyba mazání predikcí:', predError)
        setMessage('Chyba: Nelze smazat tipy k zápasu')
        return
      }

      // 2. Pak smažeme samotný zápas
      const { error: matchError } = await supabase
        .from('matches')
        .delete()
        .eq('id', id)

      if (matchError) {
        console.error('Chyba mazání zápasu:', matchError)
        setMessage('Chyba: ' + matchError.message)
        return
      }

      setMessage('Zápas smazán')
      setDeleteConfirm(null)
      loadData()
    } catch (err: any) {
      console.error('Chyba při mazání:', err)
      setMessage('Chyba při mazání: ' + (err?.message || 'Neznámá chyba'))
    }
  }

  const visibleMatches = showFinished 
    ? matches 
    : matches.filter((m: Match) => m.status !== 'finished')

  if (isAdmin === null) return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center"><div className="animate-pulse text-gray-500 dark:text-gray-400">Načítání...</div></div>
  if (isAdmin === false) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-lg text-center max-w-md border border-gray-200 dark:border-gray-700">
        <div className="flex justify-center mb-4">
          <Image src={theme === 'dark' ? '/icons/lock-dark.svg' : '/icons/lock-light.svg'} alt="Přístup odepřen" width={48} height={48} unoptimized={true} />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Přístup odepřen</h1>
        <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Zpět na úvod</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      {/* ===== NAVBAR S HAMBURGER MENU ===== */}
      <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo vlevo */}
          <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Image src={theme === 'dark' ? '/icons/logo-trophy-dark.png' : '/icons/logo-trophy-light.png'} alt="Admin" width={24} height={24} unoptimized={true} />
            Admin
          </span>

          {/* Pravá část: Toggle odehrané (jen v zápasech) + Theme + Hamburger */}
          <div className="flex items-center gap-3">
            {/* Toggle Zobrazit odehrané - jen když jsme v zápasech */}
            {activeTab === 'matches' && (
              <div className="flex items-center gap-2 mr-1">
                <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">Odehrané</span>
                <button
                  onClick={() => setShowFinished(!showFinished)}
                  className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
                    showFinished ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  title={showFinished ? 'Skrýt odehrané' : 'Zobrazit odehrané'}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                      showFinished ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Theme toggle */}
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title={theme === 'light' ? 'Tmavý režim' : 'Světlý režim'}
            >
              <Image 
                src={theme === 'light' ? '/icons/theme-moon.svg' : '/icons/theme-sun.svg'} 
                alt="Theme" 
                width={20} 
                height={20} 
                unoptimized={true} 
              />
            </button>

            {/* Hamburger menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                title="Menu"
              >
                <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Dropdown menu */}
              {menuOpen && (
                <>
                  {/* Overlay pro zavření kliknutím mimo */}
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />

                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 py-1">
                    <button
                      onClick={() => { setActiveTab('matches'); setMenuOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition flex items-center gap-2 ${
                        activeTab === 'matches' 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Zápasy
                    </button>

                    <button
                      onClick={() => { setActiveTab('leaderboard'); loadLeaderboard(); setMenuOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition flex items-center gap-2 ${
                        activeTab === 'leaderboard' 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Žebříček
                    </button>

                    <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Hráč
                    </Link>

                    <form action="/api/auth/logout" method="post" className="m-0">
                      <button 
                        type="submit" 
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Odhlásit
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {message && <div className="mb-6 p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm font-medium">{message}</div>}

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 dark:text-white">Turnaje</h2>
            <button onClick={() => setShowNewTournament(!showNewTournament)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1">
              <Image src="/icons/add-plus-light.svg" alt="" width={14} height={14} className="invert" unoptimized={true} />
              Nový turnaj
            </button>
          </div>

          {showNewTournament && (
            <form onSubmit={createTournament} className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 space-y-3">
              <input required placeholder="Název turnaje" className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={newTournament.name} onChange={e => setNewTournament({...newTournament, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <select className="p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none" value={newTournament.sport} onChange={e => setNewTournament({...newTournament, sport: e.target.value})}>
                  <option value="ice_hockey">Hokej</option>
                  <option value="football">Fotbal</option>
                </select>
                <input type="number" placeholder="Rok" className="p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={newTournament.season_year} onChange={e => setNewTournament({...newTournament, season_year: Number(e.target.value)})} />
              </div>
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">Vytvořit turnaj</button>
            </form>
          )}

          <div className="flex flex-wrap gap-2">
            {tournaments.map(t => (
              <button key={t.id} onClick={() => { setSelectedTournament(t.id); loadData(); }} className={`px-4 py-2 rounded-xl text-sm font-medium transition border ${selectedTournament === t.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400'}`}>
                {t.name} {t.is_active ? '(Aktivní)' : ''}
              </button>
            ))}
          </div>

          {currentTournament && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {currentTournament.status !== 'active' && currentTournament.status !== 'finished' && (
                <button onClick={() => activateTournament(currentTournament.id)} className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-100 transition">Aktivovat</button>
              )}
              {currentTournament.status === 'active' && (
                <button onClick={() => finishTournament(currentTournament.id)} className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-100 transition">Ukončit turnaj</button>
              )}
              <span className="text-xs text-gray-400 dark:text-gray-500 self-center ml-2">Status: {currentTournament.status}</span>
            </div>
          )}
        </div>

        {activeTab === 'matches' ? (
          <div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 dark:text-white">Správa zápasů</h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-1">
                    <Image src={showAddForm ? '/icons/close-x-light.svg' : '/icons/add-plus-light.svg'} alt="" width={14} height={14} className="invert" unoptimized={true} />
                    {showAddForm ? 'Zavřít' : 'Přidat zápas'}
                  </button>
                </div>
              </div>

              {showAddForm && (
                <form onSubmit={addMatch} className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input required placeholder="Domácí tým" className="p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={newMatch.home} onChange={e => setNewMatch({...newMatch, home: e.target.value})} />
                    <input required placeholder="Hostující tým" className="p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={newMatch.away} onChange={e => setNewMatch({...newMatch, away: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" required className="p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={newMatch.date} onChange={e => setNewMatch({...newMatch, date: e.target.value})} />
                    <input type="time" required className="p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={newMatch.time} onChange={e => setNewMatch({...newMatch, time: e.target.value})} />
                  </div>
                  <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">Uložit zápas</button>
                </form>
              )}

              <CsvImport onSuccess={() => { setMessage('Importováno'); loadData(); }} tournamentId={selectedTournament} />
            </div>

            <div className="space-y-3">
              {visibleMatches.length === 0 && <div className="text-center py-12 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600">Žádné zápasy</div>}
              {visibleMatches.map(m => (
                <MatchCard key={m.id} match={m} onRefresh={loadData} setMessage={setMessage} isDeleting={deleteConfirm === m.id} onConfirmDelete={() => setDeleteConfirm(m.id)} onDelete={() => deleteMatch(m.id)} onCancelDelete={() => setDeleteConfirm(null)} />
              ))}
              {!showFinished && matches.filter((m: Match) => m.status === 'finished').length > 0 && (
                <div className="text-center py-4 text-gray-400 dark:text-gray-500 text-sm">
                  {matches.filter((m: Match) => m.status === 'finished').length} odehraných zápasů skryto
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {currentTournament && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Image src={theme === 'dark' ? '/icons/nav-leaderboard-dark.svg' : '/icons/nav-leaderboard-light.svg'} alt="" width={20} height={20} unoptimized={true} />
                  Nastavení žebříčku
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      Zpráva pro hráče (zobrazí se místo žebříčku)
                    </label>
                    <textarea
                      value={leaderboardMsg}
                      onChange={(e) => setLeaderboardMsg(e.target.value)}
                      placeholder="Např.: Žebříček bude zveřejněn po skončení turnaje..."
                      className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-y text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={toggleLeaderboard}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
                        currentTournament.leaderboard_closed 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                          : 'bg-amber-500 hover:bg-amber-600 text-white'
                      }`}
                    >
                      <Image 
                        src={currentTournament.leaderboard_closed ? '/icons/eye-open-light.svg' : '/icons/eye-closed-light.svg'} 
                        alt="" 
                        width={16} 
                        height={16} 
                        className="invert" 
                        unoptimized={true} 
                      />
                      {currentTournament.leaderboard_closed ? 'Otevřít žebříček hráčům' : 'Uzavřít žebříček hráčům'}
                    </button>

                    <button
                      onClick={() => loadLeaderboard()}
                      disabled={loadingLeaderboard}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <svg className={`w-4 h-4 ${loadingLeaderboard ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {loadingLeaderboard ? 'Aktualizuji...' : 'Aktualizovat žebříček'}
                    </button>

                    <span className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                      currentTournament.leaderboard_closed 
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                    }`}>
                      {currentTournament.leaderboard_closed ? '🔒 Uzavřeno pro hráče' : '👀 Viditelné pro hráče'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <LeaderboardTab leaderboard={leaderboard} loading={loadingLeaderboard} />
          </div>
        )}
      </main>
    </div>
  )
}

function CsvImport({ onSuccess, tournamentId }: { onSuccess: () => void, tournamentId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !tournamentId) return
    setImporting(true)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/matches/import', { method: 'POST', body: formData })
    const data = await res.json()
    setImporting(false)
    if (data.success) { onSuccess(); setFile(null) }
  }
  return (
    <form onSubmit={handleImport} className="flex gap-3 items-end">
      <div className="flex-1">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">CSV: home_team,away_team,kickoff_at</p>
        <input type="file" accept=".csv" required onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-300" />
      </div>
      <button type="submit" disabled={importing} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">{importing ? '...' : 'Import CSV'}</button>
    </form>
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
    try {
      const homeScore = Number(home)
      const awayScore = Number(away)

      const res = await fetch(`/api/matches/${match.id}/evaluate`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ home_score: homeScore, away_score: awayScore }) 
      })

      const data = await res.json()

      if (!res.ok) {
        console.error('Evaluate error:', data)
        setMessage('Chyba: ' + (data.error || `HTTP ${res.status}`))
        setSaving(false)
        return
      }

      if (data.success) { 
        setMessage(`Vyhodnoceno! ${data.evaluated} tipů aktualizováno.`)
        setEditing(false)
        onRefresh()
      } else {
        setMessage('Chyba: ' + (data.error || 'Neznámá chyba'))
      }
    } catch (err) {
      console.error('Fetch error:', err)
      setMessage('Chyba připojení k serveru')
    }
    setSaving(false)
  }

  const isFinished = match.status === 'finished'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${isFinished ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>
              {isFinished ? 'Dokončeno' : 'Naplánováno'}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(match.kickoff_at).toLocaleString('cs-CZ')}</span>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
            <TeamFlag teamName={match.home_team_name} size={24} />
            <span>{match.home_team_name}</span>
            <span className="text-gray-300 dark:text-gray-600">vs</span>
            <span>{match.away_team_name}</span>
            <TeamFlag teamName={match.away_team_name} size={24} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(!isFinished || editing) ? (
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-xl p-1.5">
              <input type="number" min={0} className="w-14 p-2 border rounded-lg text-center font-bold bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={home} onChange={e => setHome(e.target.value)} />
              <span className="text-gray-400 font-bold">:</span>
              <input type="number" min={0} className="w-14 p-2 border rounded-lg text-center font-bold bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={away} onChange={e => setAway(e.target.value)} />
            </div>
          ) : (
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{match.home_score_regular} : {match.away_score_regular}</div>
          )}

          {(!isFinished || editing) && <button onClick={saveResult} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">{saving ? '...' : 'Uložit'}</button>}
          {isFinished && !editing && <button onClick={() => setEditing(true)} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-sm transition">Edit</button>}

          {isDeleting ? (
            <div className="flex gap-2">
              <button onClick={onDelete} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition">Smazat</button>
              <button onClick={onCancelDelete} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-sm transition">Zrušit</button>
            </div>
          ) : (
            <button onClick={onConfirmDelete} className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition">Del</button>
          )}
        </div>
      </div>
    </div>
  )
}

function LeaderboardTab({ leaderboard, loading }: { leaderboard: any[]; loading?: boolean }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Kompletní žebříček</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Admin vidí všechny hráče, body a přesné tipy</p>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {loading && (
          <div className="p-8 text-center text-gray-400 dark:text-gray-500">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            Načítání žebříčku...
          </div>
        )}
        {!loading && leaderboard.length === 0 && <div className="p-8 text-center text-gray-400 dark:text-gray-500">Zatím žádná data</div>}
        {!loading && leaderboard.map((row, idx) => {
          const name = row.profile?.nickname || `${row.profile?.first_name || ''} ${row.profile?.last_name || ''}`.trim() || 'Neznámý'
          return (
            <div key={row.user_id} className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
              <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm shrink-0 ${
                idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' : 
                idx === 1 ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300' : 
                idx === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : 
                'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {idx + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-900 dark:text-white truncate">{name}</div>
                {row.profile?.nickname && <div className="text-xs text-gray-500 dark:text-gray-400">{row.profile?.first_name} {row.profile?.last_name}</div>}
              </div>
              <div className="text-right shrink-0 flex gap-4">
                <div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{row.points}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">bodů</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{row.exact}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">přesných</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{row.unique}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">unikátních</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}