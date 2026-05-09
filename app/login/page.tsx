'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from '@/components/theme-provider'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const { theme } = useTheme()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

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

  const logoSrc = theme === 'dark' ? '/images/logo-trophy-dark.webp' : '/images/logo-trophy-light.webp'

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark flex items-center justify-center px-4 py-12 transition-colors">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src={logoSrc} alt="Tipovačka" width={80} height={80} className="rounded-full" unoptimized={true} priority />
          </div>
          <h1 className="text-2xl font-bold text-text-primary dark:text-white">Tipovačka</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Přihlaste se ke svému účtu</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Image src="/icons/email.webp" alt="" width={20} height={20} className="dark:invert" unoptimized={true} />
            </div>
            <input
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="email"
              placeholder="Email"
              required
              className="input-field pl-12"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Image src="/icons/lock.webp" alt="" width={20} height={20} className="dark:invert" unoptimized={true} />
            </div>
            <input
              ref={passwordRef}
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="Heslo"
              required
              className="input-field pl-12 pr-12"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <Image 
                src={showPassword ? '/icons/eye-open.webp' : '/icons/eye-closed.webp'} 
                alt="" 
                width={20} 
                height={20} 
                className="dark:invert"
                unoptimized={true}
              />
            </button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-gray-600 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary-blue focus:ring-primary-blue" />
              Zapamatovat si mě
            </label>
            <Link href="/forgot-password" className="text-primary-blue dark:text-secondary-dark hover:underline">
              Zapomenuté heslo?
            </Link>
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button type="submit" className="btn-primary w-full">
            Přihlásit se
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Nemáte účet?{' '}
          <Link href="/register" className="text-primary-blue dark:text-secondary-dark font-semibold hover:underline">
            Registrovat se
          </Link>
        </p>
      </div>
    </div>
  )
}