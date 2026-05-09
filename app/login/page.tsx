'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from '@/components/theme-provider'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const { theme } = useTheme()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Záloha pro Android autofill – přečteme hodnoty přímo z DOM
    const finalEmail = email || emailRef.current?.value || ''
    const finalPassword = password || passwordRef.current?.value || ''

    if (!finalEmail || !finalPassword) {
      setError('Vyplňte email a heslo')
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ 
      email: finalEmail, 
      password: finalPassword 
    })

    if (error) setError(error.message)
    else window.location.href = '/dashboard'
  }

  // Dynamická cesta k logu podle tématu
  const logoSrc = theme === 'dark' 
    ? '/images/logo-trophy-dark.webp' 
    : '/images/logo-trophy-light.webp'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4">
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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white transition-colors">Tipovačka</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">Přihlaste se ke svému účtu</p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm transition-colors">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 transition-colors">Email</label>
            <input 
              ref={emailRef}
              type="email" 
              name="email"
              autoComplete="email"
              required 
              className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white dark:bg-slate-700 text-slate-900 dark:text-white" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 transition-colors">Heslo</label>
            <input 
              ref={passwordRef}
              type="password" 
              name="password"
              autoComplete="current-password"
              required 
              className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white dark:bg-slate-700 text-slate-900 dark:text-white" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white p-3 rounded-lg font-semibold transition shadow-lg hover:shadow-xl"
          >
            Přihlásit se
          </button>
        </form>
        
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400 transition-colors">
          Nemáte účet?{' '}
          <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold transition-colors">
            Registrovat se
          </Link>
        </p>
      </div>
    </div>
  )
}