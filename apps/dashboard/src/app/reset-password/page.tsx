'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Invalid reset link</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          This password reset link is invalid or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="mt-4 inline-block text-sm font-semibold text-cyan-800 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-300"
        >
          Request a new link
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
      } else {
        setError(data.error || 'An error occurred. Please try again.')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="mb-4 text-green-600">
          <CheckCircle2 className="mx-auto h-12 w-12" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Password reset successfully</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Your password has been updated. You can now sign in with your new password.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block"
        >
          <Button className="bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 rounded-xl sm:rounded-lg cursor-pointer">
            Sign In
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="text-center mb-8 sm:mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reset your password</h1>
        <p className="mt-2 text-base sm:text-sm text-gray-500 dark:text-gray-400">
          Enter your new password below.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            New Password
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
        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Confirm Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-4 sm:w-4 text-gray-400" />
            <Input
              id="confirm-password"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              minLength={8}
              className="pl-12 sm:pl-10 pr-12 h-14 sm:h-11 text-base sm:text-sm rounded-xl sm:rounded-lg border-gray-300 dark:border-gray-700 focus:border-cyan-600 focus:ring-cyan-600"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-400 transition-colors cursor-pointer"
              tabIndex={-1}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? (
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
              Resetting...
            </>
          ) : (
            'Reset Password'
          )}
        </Button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900 sm:bg-gradient-to-br sm:from-slate-50 sm:to-slate-100 dark:sm:from-gray-950 dark:sm:to-gray-900">
      <div className="flex-1 flex flex-col sm:items-center sm:justify-start px-6 py-8 sm:pt-[30px]">
        {/* Logo */}
        <div className="flex justify-center mb-8 sm:mb-6">
          <Image src="/logo.svg" alt="Newsworthy" width={260} height={49} priority className="dark:brightness-0 dark:invert" />
        </div>

        {/* Card */}
        <div className="w-full sm:max-w-md sm:bg-white dark:bg-gray-900 sm:rounded-2xl sm:shadow-xl sm:border sm:border-slate-200 dark:border-gray-800 sm:p-8">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
