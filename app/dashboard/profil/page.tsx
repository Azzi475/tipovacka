'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ProfilPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(data)
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    const { error } = await supabase.from('profiles').update({
      first_name: profile.first_name,
      last_name: profile.last_name,
      nickname: profile.nickname
    }).eq('id', profile.id)
    if (error) setMessage('Chyba: ' + error.message)
    else setMessage('Profil uložen! ✅')
  }

  if (loading) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Načítání...</div>
  if (!profile) return <div className="p-8 text-center text-slate-400">Nepřihlášen</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Profil</h1>
      {message && <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm font-medium">{message}</div>}

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
        <h2 className="font-bold text-slate-900 dark:text-white mb-4">Osobní údaje</h2>
        <form onSubmit={updateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Přezdívka</label>
            <input className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white" value={profile.nickname || ''} onChange={e => setProfile({...profile, nickname: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Jméno</label>
              <input className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white" value={profile.first_name || ''} onChange={e => setProfile({...profile, first_name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Příjmení</label>
              <input className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white" value={profile.last_name || ''} onChange={e => setProfile({...profile, last_name: e.target.value})} />
            </div>
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold transition">Uložit změny</button>
        </form>
      </div>
    </div>
  )
}