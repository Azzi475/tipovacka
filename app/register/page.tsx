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

  const logoSrc = theme === 'dark' ? '/icons/logo-trophy-dark.png' : '/icons/logo-trophy-light.png'

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark flex items-center justify-center px-4 py-12 transition-colors">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src={logoSrc} alt="Tipovačka" width={80} height={80} className="rounded-full" unoptimized={true} priority />
          </div>
          <h1 className="text-2xl font-bold text-text-primary dark:text-white">Registrace</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Vytvořte si účet a začněte tipovat</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input ref={refs.first_name} name="first_name" placeholder="Jméno" required className="input-field" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} />
            <input ref={refs.last_name} name="last_name" placeholder="Příjmení" required className="input-field" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} />
          </div>
          <input ref={refs.nickname} name="nickname" placeholder="Přezdívka" required className="input-field" value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} />
          <input ref={refs.email} type="email" name="email" placeholder="Email" autoComplete="email" required className="input-field" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <input ref={refs.password} type="password" name="password" placeholder="Heslo (min. 6 znaků)" autoComplete="new-password" required minLength={6} className="input-field" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />

          <button type="submit" className="btn-primary w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600">
            Vytvořit účet
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Už máte účet?{' '}
          <Link href="/login" className="text-primary-blue dark:text-secondary-dark font-semibold hover:underline">
            Přihlásit se
          </Link>
        </p>
      </div>
    </div>
  )
}