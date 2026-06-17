'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  first_name: string
  last_name: string
  nickname: string
  email: string
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [passwords, setPasswords] = useState({ new: '', confirm: '' })

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setProfile(data)
    setLoading(false)
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: profile?.first_name,
        last_name: profile?.last_name,
        nickname: profile?.nickname,
      })
      .eq('id', user.id)

    if (error) setMessage('Chyba při ukládání')
    else setMessage('Profil uložen')
    setSaving(false)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwords.new !== passwords.confirm) {
      setMessage('Hesla se neshodují')
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: passwords.new })

    if (error) setMessage('Chyba při změně hesla')
    else {
      setMessage('Heslo změněno')
      setPasswords({ new: '', confirm: '' })
    }
  }

  if (loading) return <div className="text-center py-8">Načítání...</div>

  return (
    <div className="py-4 space-y-6">
      <h2 className="text-[32px] leading-[40px] font-semibold text-text-primary dark:text-white">
        Profil
      </h2>

      <form onSubmit={handleUpdateProfile} className="p-6 space-y-4 rounded-2xl border border-gray-200 dark:border-border-dark shadow-sm bg-white/70 dark:bg-card-dark/70">
        <h3 className="text-lg font-semibold text-text-primary dark:text-white flex items-center gap-2">
          <Image src="/icons/nav-profile-light.svg" alt="" width={20} height={20} className="dark:hidden" unoptimized={true} />
          <Image src="/icons/nav-profile-dark.svg" alt="" width={20} height={20} className="hidden dark:block" unoptimized={true} />
          Osobní údaje
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Jméno</label>
            <input
              type="text"
              value={profile?.first_name || ''}
              onChange={(e) => setProfile(p => p ? { ...p, first_name: e.target.value } : null)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Příjmení</label>
            <input
              type="text"
              value={profile?.last_name || ''}
              onChange={(e) => setProfile(p => p ? { ...p, last_name: e.target.value } : null)}
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Přezdívka</label>
          <input
            type="text"
            value={profile?.nickname || ''}
            onChange={(e) => setProfile(p => p ? { ...p, nickname: e.target.value } : null)}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Email</label>
          <input type="email" value={profile?.email || ''} disabled className="input-field opacity-50" />
        </div>

        {message && (
          <p className={`text-sm text-center ${message.includes('Chyba') ? 'text-red-500' : 'text-teal'}`}>
            {message}
          </p>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full">
          <Image src="/icons/checkbox-empty-light.svg" alt="" width={16} height={16} className="dark:hidden" unoptimized={true} />
          <Image src="/icons/checkbox-empty-dark.svg" alt="" width={16} height={16} className="hidden dark:block" unoptimized={true} />
          {saving ? 'Ukládání...' : 'Uložit změny'}
        </button>
      </form>

      <form onSubmit={handleChangePassword} className="p-6 space-y-4 rounded-2xl border border-gray-200 dark:border-border-dark shadow-sm bg-white/70 dark:bg-card-dark/70">
        <h3 className="text-lg font-semibold text-text-primary dark:text-white flex items-center gap-2">
          <Image src="/icons/lock-light.svg" alt="" width={20} height={20} className="dark:hidden" unoptimized={true} />
          <Image src="/icons/lock-dark.svg" alt="" width={20} height={20} className="hidden dark:block" unoptimized={true} />
          Změna hesla
        </h3>

        <input
          type="password"
          placeholder="Nové heslo"
          value={passwords.new}
          onChange={(e) => setPasswords(p => ({ ...p, new: e.target.value }))}
          className="input-field"
          minLength={6}
        />

        <input
          type="password"
          placeholder="Potvrdit heslo"
          value={passwords.confirm}
          onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))}
          className="input-field"
        />

        <button type="submit" className="btn-secondary w-full">
          Změnit heslo
        </button>
      </form>

      {/* Patička */}
      <footer className="text-center py-6 border-t border-gray-200 dark:border-gray-700 mt-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          2026 © Jan Arazim | Ver. 1.8.3
        </p>
      </footer>
    </div>
  )
}