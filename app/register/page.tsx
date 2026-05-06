'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📝</div>
          <h1 className="text-2xl font-bold text-slate-800">Registrace</h1>
          <p className="text-slate-500 text-sm mt-1">Vytvořte si účet a začněte tipovat</p>
        </div>
        
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
        
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jméno</label>
              <input ref={refs.first_name} name="first_name" required className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Příjmení</label>
              <input ref={refs.last_name} name="last_name" required className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Přezdívka</label>
            <input ref={refs.nickname} name="nickname" required className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input ref={refs.email} type="email" name="email" autoComplete="email" required className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Heslo (min. 6 znaků)</label>
            <input ref={refs.password} type="password" name="password" autoComplete="new-password" required minLength={6} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          </div>
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-lg font-semibold transition shadow-lg hover:shadow-xl">
            Vytvořit účet
          </button>
        </form>
        
        <p className="mt-6 text-center text-sm text-slate-500">
          Už máte účet? <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">Přihlásit se</Link>
        </p>
      </div>
    </div>
  )
}