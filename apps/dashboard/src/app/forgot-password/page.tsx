'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Mail, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (response.ok) {
        setSent(true)
      } else {
        setError('An error occurred. Please try again.')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 sm:bg-gradient-to-br sm:from-slate-50 sm:to-slate-100 dark:sm:from-gray-950 dark:sm:to-gray-900">
      <div className="flex-1 flex flex-col sm:items-center sm:justify-start px-6 py-8 sm:pt-[30px]">
        {/* Logo */}
        <div className="flex justify-center mb-8 sm:mb-6">
          <Image src="/logo.svg" alt="Newsworthy" width={260} height={49} priority className="dark:brightness-0 dark:invert" />
        </div>

        {/* Card */}
        <div className="w-full sm:max-w-md sm:bg-white dark:bg-gray-900 sm:rounded-2xl sm:shadow-xl sm:border sm:border-slate-200 dark:border-gray-800 sm:p-8">
          {sent ? (
            <div className="text-center py-8">
              <div className="mb-4 text-cyan-700">
                <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Check your email</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                If an account exists for <strong>{email}</strong>, we sent a password reset link.
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                This link will expire in 1 hour.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center text-sm font-semibold text-cyan-800 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-300"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center mb-8 sm:mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Forgot your password?</h1>
                <p className="mt-2 text-base sm:text-sm text-gray-500 dark:text-gray-400">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
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
                <Button
                  type="submit"
                  className="w-full h-14 sm:h-11 text-base sm:text-sm font-semibold bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 rounded-xl sm:rounded-lg transition-colors cursor-pointer"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 sm:h-4 sm:w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </form>

              <p className="mt-8 sm:mt-6 text-center text-base sm:text-sm text-gray-500 dark:text-gray-400">
                <Link href="/login" className="inline-flex items-center font-semibold text-cyan-800 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-300">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
