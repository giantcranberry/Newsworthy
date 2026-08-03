'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Mail, Lock, Eye, EyeOff, User } from 'lucide-react'

interface CoregisterFormProps {
  partnerId: number
  brandName: string | null
  logo: string | null
  company: string | null
}

export function CoregisterForm({ partnerId, brandName, logo, company }: CoregisterFormProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const displayName = brandName || company || 'Partner'

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password, partnerId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      // The register API sets the session cookie — land straight on the
      // dashboard. Email verification is required later, at press-release
      // submission.
      window.location.href = '/dashboard'
      return
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthLogin = (provider: string) => {
    // Set cookie so the OAuth callback can pick up the partnerId
    document.cookie = `coregister_partner_id=${partnerId};path=/;max-age=600;samesite=lax`
    signIn(provider, { callbackUrl: '/dashboard' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 sm:bg-gradient-to-br sm:from-slate-50 sm:to-slate-100">
      <div className="flex-1 flex flex-col sm:items-center sm:justify-start px-6 py-8 sm:pt-[30px]">
        {/* Logo */}
        <div className="flex justify-center mb-8 sm:mb-6">
          <Image src="/logo.svg" alt="Newsworthy" width={260} height={49} priority />
        </div>

        {/* Card */}
        <div className="w-full sm:max-w-md sm:bg-white dark:bg-gray-900 sm:rounded-2xl sm:shadow-xl sm:border sm:border-slate-200 dark:border-gray-800 sm:p-8">
          {/* Partner branding */}
          <div className="flex flex-col items-center mb-6 pb-6 border-b border-slate-200 dark:border-gray-800">
            {logo && (
              <div className="mb-3">
                <Image
                  src={logo}
                  alt={displayName}
                  width={120}
                  height={60}
                  className="object-contain max-h-[60px]"
                />
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Brought to you by <span className="font-semibold text-gray-700 dark:text-gray-300">{displayName}</span>
            </p>
          </div>

          {/* Header */}
          <div className="text-center mb-8 sm:mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Create your account</h1>
            <p className="mt-2 text-base sm:text-sm text-gray-500 dark:text-gray-400">
              Get started with Newsworthy
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {emailSent ? (
            <div className="text-center py-8">
              <div className="mb-4 text-cyan-700">
                <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Check your email</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                We sent a verification link to <strong>{email}</strong>
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Click the link to verify your account and get started.
              </p>
              <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-cyan-800 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-300">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      First Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-4 sm:w-4 text-gray-400" />
                      <Input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First"
                        required
                        className="pl-12 sm:pl-10 h-14 sm:h-11 text-base sm:text-sm rounded-xl sm:rounded-lg border-gray-300 dark:border-gray-700 focus:border-cyan-600 focus:ring-cyan-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last"
                      className="h-14 sm:h-11 text-base sm:text-sm rounded-xl sm:rounded-lg border-gray-300 dark:border-gray-700 focus:border-cyan-600 focus:ring-cyan-600"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-4 sm:w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="pl-12 sm:pl-10 h-14 sm:h-11 text-base sm:text-sm rounded-xl sm:rounded-lg border-gray-300 dark:border-gray-700 focus:border-cyan-600 focus:ring-cyan-600"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-4 sm:w-4 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                      className="pl-12 sm:pl-10 pr-12 h-14 sm:h-11 text-base sm:text-sm rounded-xl sm:rounded-lg border-gray-300 dark:border-gray-700 focus:border-cyan-600 focus:ring-cyan-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-400 transition-colors cursor-pointer"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 sm:h-4 sm:w-4" />
                      ) : (
                        <Eye className="h-5 w-5 sm:h-4 sm:w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 sm:h-11 text-base sm:text-sm font-semibold bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 rounded-xl sm:rounded-lg transition-colors cursor-pointer"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 sm:h-4 sm:w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-800" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white dark:bg-gray-900 px-2 text-gray-500 dark:text-gray-400">Or sign up with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleOAuthLogin('google')}
                  className="w-full h-12 sm:h-10 rounded-xl sm:rounded-lg border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 cursor-pointer"
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOAuthLogin('linkedin')}
                  className="w-full h-12 sm:h-10 rounded-xl sm:rounded-lg border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 cursor-pointer"
                >
                  <svg className="h-5 w-5 mr-2" fill="#0A66C2" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </Button>
              </div>

              <p className="mt-8 sm:mt-6 text-center text-base sm:text-sm text-gray-500 dark:text-gray-400">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-cyan-800 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-300">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
