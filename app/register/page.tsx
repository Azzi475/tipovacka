'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from '@/components/theme-provider'

export default function RegisterPage() {
  const [form, setForm] = useState({ first_name: '', last_name: '', nickname: '', email: '', password: '' })
  const [error, setError] = useState('')
  const refs = {
    first_name: useRef<HTMLInputElement>(null),
    last_name: useRef<HTMLInputElement>(null),
    nickname: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
  }
  const supabase = createClient()
  const { theme } = useTheme()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Záloha pro Android autofill
    const finalEmail = form.email || refs.email.current?.value || ''
    const finalPassword = form.password || refs.password.current?.value || ''
    const finalFirst = form.first_name || refs.first_name.current?.value || ''
    const finalLast = form.last_name || refs.last_name.current?.value || ''
    const finalNick = form.nickname || refs.nickname.current?.value || ''

    if (!finalEmail || !finalPassword || !finalFirst || !finalLast || !finalNick) {
      setError('Vyplňte všechna pole')
      return
    }

    const { error } = await supabase.auth.signUp({
      email: finalEmail,
      password: finalPassword,
      options: { data: { first_name: finalFirst, last_name: finalLast, nickname: finalNick } }
    })

    if (error) setError(error.message)
    else window.location.href = '/login'
  }

  // Dynamická cesta k logu podle tématu
  const logoSrc = theme === 'dark' 
    ? '/images/logo-trophy-dark.webp' 
    : '/images/logo-trophy-light.webp'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4 py-8">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8 transition-colors duration-300">
        <div className="text-center mb-8">
          {/* OPRAVA: WEBP logo s dark/light theme a unoptimized */}
          <div className="flex justify-center mb-3">
            <Image 
              src={logoSrc}
              alt="Tipovačka" 
              width={64} 
              height={64} 
              className="rounded-full"
              unoptimized={true}
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white transition-colors">Registrace</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">Vytvořte si účet a začněte tipovat</p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm transition-colors">
            {error}
          </div>
        )}
        
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 transition-colors">Jméno</label>
              <input 
                ref={refs.first_name} 
                name="first_name" 
                required 
                className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white dark:bg-slate-700 text-slate-900 dark:text-white" 
                value={form.first_name} 
                onChange={e => setForm({...form, first_name: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 transition-colors">Příjmení</label>
              <input 
                ref={refs.last_name} 
                name="last_name" 
                required 
                className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white dark:bg-slate-700 text-slate-900 dark:text-white" 
                value={form.last_name} 
                onChange={e => setForm({...form, last_name: e.target.value})} 
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 transition-colors">Přezdívka</label>
            <input 
              ref={refs.nickname} 
              name="nickname" 
              required 
              className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white dark:bg-slate-700 text-slate-900 dark:text-white" 
              value={form.nickname} 
              onChange={e => setForm({...form, nickname: e.target.value})} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 transition-colors">Email</label>
            <input 
              ref={refs.email} 
              type="email" 
              name="email" 
              autoComplete="email" 
              required 
              className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white dark:bg-slate-700 text-slate-900 dark:text-white" 
              value={form.email} 
              onChange={e => setForm({...form, email: e.target.value})} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 transition-colors">Heslo (min. 6 znaků)</label>
            <input 
              ref={refs.password} 
              type="password" 
              name="password" 
              autoComplete="new-password" 
              required 
              minLength={6} 
              className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white dark:bg-slate-700 text-slate-900 dark:text-white" 
              value={form.password} 
              onChange={e => setForm({...form, password: e.target.value})} 
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white p-3 rounded-lg font-semibold transition shadow-lg hover:shadow-xl"
          >
            Vytvořit účet
          </button>
        </form>
        
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400 transition-colors">
          Už máte účet?{' '}
          <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold transition-colors">
            Přihlásit se
          </Link>
        </p>
      </div>
    </div>
  )
}