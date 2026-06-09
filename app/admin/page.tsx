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
  admin_message?: string | null
  admin_message_sent_at?: string | null
  admin_message_target?: string | null
  background_theme?: string | null
  leaderboard_show_details?: boolean
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
  const [activeTab, setActiveTab] = useState<'matches' | 'leaderboard' | 'settings'>('matches')
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
  const [adminMsg, setAdminMsg] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [msgTarget, setMsgTarget] = useState<"all" | "active">("all")
  const [scrapeResults, setScrapeResults] = useState<any[]>([])
  const [showScrapePreview, setShowScrapePreview] = useState(false)
  const [scraping, setScraping] = useState(false)

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
    // 1. Najdi všechny zápasy turnaje
    const { data: matchIds } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', id)

    // 2. Smaž všechny tipy pro tyto zápasy
    if (matchIds && matchIds.length > 0) {
      const ids = matchIds.map((m: any) => m.id)
      const { error: predError } = await supabase
        .from('predictions')
        .delete()
        .in('match_id', ids)

      if (predError) {
        setMessage('Chyba při mazání tipů: ' + predError.message)
        return
      }
    }

    // 3. Ukonči turnaj
    const { error } = await supabase.from('tournaments').update({ is_active: false, status: 'finished' }).eq('id', id)
    if (!error) { setMessage('Turnaj ukončen – tipy smazány'); loadData() }
  }

  async function deleteMatch(id: string) {
    try {
      const { error: predError } = await supabase.from('predictions').delete().eq('match_id', id)
      if (predError) {
        console.error('Chyba mazání predikcí:', predError)
        setMessage('Chyba: Nelze smazat tipy k zápasu')
        return
      }
      const { error: matchError } = await supabase.from('matches').delete().eq('id', id)
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

  async function fetchResults() {
    if (!currentTournament) return
    setScraping(true)
    try {
      const res = await fetch('/api/matches/fetch-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: currentTournament.id })
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage('Chyba: ' + (data.error || 'Neznámá chyba'))
      } else {
        setScrapeResults(data.results || [])
        setShowScrapePreview(true)
        if (data.errors?.length > 0) {
          setMessage('Varování: ' + data.errors.join(', '))
        }
      }
    } catch (err: any) {
      setMessage('Chyba připojení: ' + (err?.message || 'Neznámá chyba'))
    }
    setScraping(false)
  }

  async function applyScrapedResults() {
    let updated = 0
    for (const r of scrapeResults) {
      if (r.home_score !== null && r.away_score !== null) {
        const res = await fetch(`/api/matches/${r.match_id}/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ home_score: r.home_score, away_score: r.away_score })
        })
        if (res.ok) updated++
      }
    }
    setMessage(`Vyhodnoceno ${updated} zápasů!`)
    setShowScrapePreview(false)
    setScrapeResults([])
    loadData()
  }

  async function sendAdminMessage() {
    if (!currentTournament || !adminMsg.trim()) return
    setSendingMsg(true)
    const { error } = await supabase
      .from('tournaments')
      .update({
        admin_message: adminMsg.trim(),
        admin_message_sent_at: new Date().toISOString(),
        admin_message_target: msgTarget
      })
      .eq('id', currentTournament.id)

    if (error) {
      setMessage('Chyba: ' + error.message)
    } else {
      const targetText = msgTarget === 'active' ? 'aktivním hráčům' : 'všem hráčům'
      setMessage('Zpráva odeslána ' + targetText + '!')
      setCurrentTournament({ ...currentTournament, admin_message: adminMsg.trim(), admin_message_sent_at: new Date().toISOString(), admin_message_target: msgTarget })
      setAdminMsg('')
    }
    setSendingMsg(false)
  }

  async function setBackground(theme: string) {
    if (!currentTournament) return
    const { error } = await supabase
      .from('tournaments')
      .update({ background_theme: theme || null })
      .eq('id', currentTournament.id)

    if (error) {
      setMessage('Chyba: ' + error.message)
    } else {
      setMessage(theme ? `Pozadí nastaveno` : 'Pozadí odstraněno')
      setCurrentTournament({ ...currentTournament, background_theme: theme || null })
    }
  }

  async function toggleShowDetails() {
    if (!currentTournament) return
    const newVal = !currentTournament.leaderboard_show_details
    const { error } = await supabase
      .from('tournaments')
      .update({ leaderboard_show_details: newVal })
      .eq('id', currentTournament.id)

    if (error) {
      setMessage('Chyba: ' + error.message)
    } else {
      setMessage(newVal ? 'Detaily zobrazeny v žebříčku hráčů' : 'Detaily skryty v žebříčku hráčů')
      setCurrentTournament({ ...currentTournament, leaderboard_show_details: newVal })
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
          <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Image src={theme === 'dark' ? '/icons/logo-trophy-dark.png' : '/icons/logo-trophy-light.png'} alt="Admin" width={24} height={24} unoptimized={true} />
            Admin
          </span>

          <div className="flex items-center gap-3">
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

              {menuOpen && (
                <>
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

                    <button
                      onClick={() => { setActiveTab('settings'); setMenuOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition flex items-center gap-2 ${
                        activeTab === 'settings' 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Nastavení
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
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={fetchResults}
                  disabled={scraping}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className={`w-4 h-4 ${scraping ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {scraping ? 'Načítám...' : 'Načíst výsledky (API-Football)'}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Načte výsledky ze základní hrací doby (90 min) přes API-Football. Vyžaduje API klíč v proměnné prostředí API_FOOTBALL_KEY.
                </p>
              </div>
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
        ) : activeTab === 'leaderboard' ? (
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

                  <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={toggleShowDetails}
                      className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
                        currentTournament.leaderboard_show_details ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                          currentTournament.leaderboard_show_details ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {currentTournament.leaderboard_show_details 
                        ? 'Zobrazit body, přesné a unikátní tipy v žebříčku hráčů' 
                        : 'Skrýt detaily v žebříčku hráčů (zobrazit pouze # a jméno)'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <LeaderboardTab leaderboard={leaderboard} loading={loadingLeaderboard} />
          </div>
        ) : (
          /* ===== ZÁLOŽKA NASTAVENÍ ===== */
          <div className="space-y-6">
            {currentTournament ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Nastavení turnaje
                </h3>

                {/* Zpráva hráčům */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Zpráva hráčům (zobrazí se při otevření dashboardu)
                  </label>
                  <textarea
                    value={adminMsg}
                    onChange={(e) => setAdminMsg(e.target.value)}
                    placeholder="Napiš zprávu, která hráčům vyskočí po přihlášení..."
                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y text-sm mb-2"
                  />
                  <div className="flex items-center gap-3 flex-wrap mb-3">
                    <button
                      onClick={sendAdminMessage}
                      disabled={sendingMsg || !adminMsg.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                    >
                      {sendingMsg ? 'Odesílám...' : 'Odeslat zprávu'}
                    </button>
                    {currentTournament.admin_message && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Aktuální: <span className="italic">{currentTournament.admin_message.substring(0, 60)}{currentTournament.admin_message.length > 60 ? '...' : ''}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Cílová skupina:</span>
                    <button
                      onClick={() => setMsgTarget('all')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        msgTarget === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      Všichni registrovaní
                    </button>
                    <button
                      onClick={() => setMsgTarget('active')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        msgTarget === 'active'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      Jen aktivní hráči
                    </button>
                  </div>
                </div>

                {/* Pozadí turnaje */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pozadí pro hráče (50 % průhlednost na dashboardu)
                  </label>
                  <div className="flex gap-3 flex-wrap">
                    {[
                      { key: 'hockey-light', label: 'Hokej světlý' },
                      { key: 'hockey-dark', label: 'Hokej tmavý' },
                      { key: 'football-light', label: 'Fotbal světlý' },
                      { key: 'football-dark', label: 'Fotbal tmavý' },
                    ].map((bg) => (
                      <button
                        key={bg.key}
                        onClick={() => setBackground(bg.key)}
                        className={`relative w-36 h-24 rounded-xl border-2 overflow-hidden transition ${
                          currentTournament.background_theme === bg.key
                            ? 'border-blue-600 ring-2 ring-blue-500'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-400'
                        }`}
                      >
                        <div
                          className="absolute inset-0 bg-cover bg-center"
                          style={{ backgroundImage: `url(/images/${bg.key}.png)` }}
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-xs font-bold text-white drop-shadow-md">{bg.label}</span>
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={() => setBackground('')}
                      className={`w-36 h-24 rounded-xl border-2 border-dashed flex items-center justify-center text-xs font-medium transition ${
                        !currentTournament.background_theme
                          ? 'border-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                      }`}
                    >
                      Žádné pozadí
                    </button>
                  </div>
                </div>

                {/* ===== HRÁČI TURNAJE ===== */}
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Hráči turnaje
                    </h4>
                    <button
                      onClick={() => loadData()}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1 transition"
                      title="Obnovit seznam hráčů"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Obnovit
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Zaklikni hráče, kteří se zúčastní aktuálního turnaje. Nezapsaní hráči neuvidí žebříček ani zápasy.
                  </p>
                  <TournamentPlayers tournamentId={currentTournament.id} />
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                Vyber turnaj výše pro zobrazení nastavení.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal náhledu výsledků */}
      {showScrapePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Výsledky z API-Football (základní hrací doba)</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Zkontroluj výsledky před potvrzením. Prázdná pole znamenají, že zápas nebyl nalezen.
            </p>
            <div className="space-y-2 mb-6">
              {scrapeResults.map((r: any) => (
                <div key={r.match_id} className={`flex items-center justify-between p-3 rounded-lg border ${
                  r.home_score !== null 
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' 
                    : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                }`}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-900 dark:text-white">{r.home_team_name}</span>
                    <span className="text-gray-400">vs</span>
                    <span className="font-medium text-gray-900 dark:text-white">{r.away_team_name}</span>
                    <span className="text-xs text-gray-400">{new Date(r.kickoff_at).toLocaleString('cs-CZ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.home_score !== null ? (
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {r.home_score} : {r.away_score}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Nenalezeno</span>
                    )}
                    <span className="text-xs text-gray-400">({r.source})</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={applyScrapedResults}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-semibold transition"
              >
                Potvrdit a vyhodnotit
              </button>
              <button
                onClick={() => { setShowScrapePreview(false); setScrapeResults([]); }}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-xl font-semibold transition"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}
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
    formData.append('tournament_id', tournamentId)
    try {
      const res = await fetch('/api/matches/import', { method: 'POST', body: formData })
      let data
      try {
        data = await res.json()
      } catch {
        data = { error: 'Server nevrátil JSON. Status: ' + res.status }
      }
      setImporting(false)
      if (!res.ok || !data.success) {
        alert('Chyba importu: ' + (data.error || data.message || `HTTP ${res.status}`))
        return
      }
      onSuccess()
      setFile(null)
    } catch (err: any) {
      setImporting(false)
      alert('Chyba připojení: ' + (err?.message || 'Neznámá chyba'))
    }
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
  const supabase = createClient()
  const [home, setHome] = useState(match.home_score_regular ?? '')
  const [away, setAway] = useState(match.away_score_regular ?? '')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTime, setEditTime] = useState(false)
  const [editDateVal, setEditDateVal] = useState(() => {
    const d = new Date(match.kickoff_at)
    return d.toISOString().split('T')[0]
  })
  const [editTimeVal, setEditTimeVal] = useState(() => {
    const d = new Date(match.kickoff_at)
    return d.toTimeString().slice(0, 5)
  })
  const [savingTime, setSavingTime] = useState(false)

  useEffect(() => {
    setHome(match.home_score_regular ?? '')
    setAway(match.away_score_regular ?? '')
    setEditing(false)
    setEditTime(false)
    const d = new Date(match.kickoff_at)
    setEditDateVal(d.toISOString().split('T')[0])
    setEditTimeVal(d.toTimeString().slice(0, 5))
  }, [match.home_score_regular, match.away_score_regular, match.status, match.kickoff_at])

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

  const saveTime = async () => {
    setSavingTime(true)
    try {
      const kickoff = new Date(`${editDateVal}T${editTimeVal}:00`).toISOString()
      const { error } = await supabase
        .from('matches')
        .update({ kickoff_at: kickoff })
        .eq('id', match.id)

      if (error) {
        setMessage('Chyba: ' + error.message)
      } else {
        setMessage('Čas zápasu upraven!')
        setEditTime(false)
        onRefresh()
      }
    } catch (err: any) {
      setMessage('Chyba při úpravě času: ' + (err?.message || 'Neznámá chyba'))
    }
    setSavingTime(false)
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
            {!editTime ? (
              <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(match.kickoff_at).toLocaleString('cs-CZ')}</span>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={editDateVal}
                  onChange={(e) => setEditDateVal(e.target.value)}
                  className="text-xs p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="time"
                  value={editTimeVal}
                  onChange={(e) => setEditTimeVal(e.target.value)}
                  className="text-xs p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={saveTime}
                  disabled={savingTime}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1.5 rounded font-semibold transition disabled:opacity-50"
                >
                  {savingTime ? '...' : 'Uložit'}
                </button>
                <button
                  onClick={() => setEditTime(false)}
                  className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1.5 rounded transition"
                >
                  Zrušit
                </button>
              </div>
            )}
            {!editTime && !isFinished && (
              <button
                onClick={() => setEditTime(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                title="Upravit čas zápasu"
              >
                Upravit čas
              </button>
            )}
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

function TournamentPlayers({ tournamentId }: { tournamentId: string }) {
  const supabase = createClient()
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPlayers()
  }, [tournamentId])

  async function loadPlayers() {
    setLoading(true)
    // 1. Načti všechny profily
    const { data: profs } = await supabase.from('profiles').select('id, nickname, first_name, last_name').order('nickname', { ascending: true })

    // 2. Načti účastníky turnaje
    const { data: participants } = await supabase
      .from('tournament_participants')
      .select('user_id, is_active')
      .eq('tournament_id', tournamentId)

    const partMap: Record<string, boolean> = {}
    participants?.forEach((p: any) => { partMap[p.user_id] = p.is_active })

    const merged = (profs || []).map((p: any) => ({
      ...p,
      is_active: partMap[p.id] ?? false
    }))

    setPlayers(merged)
    setLoading(false)
  }

  async function togglePlayer(userId: string, currentActive: boolean) {
    const newActive = !currentActive
    if (newActive) {
      // Přidej hráče do turnaje
      const { error } = await supabase
        .from('tournament_participants')
        .upsert({ user_id: userId, tournament_id: tournamentId, is_active: true }, { onConflict: 'user_id,tournament_id' })
      if (error) console.error('Chyba:', error)
    } else {
      // Odeber hráče
      const { error } = await supabase
        .from('tournament_participants')
        .delete()
        .eq('user_id', userId)
        .eq('tournament_id', tournamentId)
      if (error) console.error('Chyba:', error)
    }
    await loadPlayers()
  }

  if (loading) return <div className="text-sm text-gray-400 dark:text-gray-500">Načítání hráčů...</div>

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
      <div className="max-h-[400px] overflow-y-auto">
        {players.length === 0 && (
          <div className="p-4 text-center text-sm text-gray-400 dark:text-gray-500">Žádní registrovaní hráči</div>
        )}
        {players.map((p) => {
          const name = p.nickname || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Neznámý'
          return (
            <div key={p.id} className="flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${p.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</span>
              </div>
              <button
                onClick={() => togglePlayer(p.id, p.is_active)}
                className={`relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0 ${
                  p.is_active ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                title={p.is_active ? 'Odebrat z turnaje' : 'Přidat do turnaje'}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                    p.is_active ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )
        })}
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