'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        // Redirect to the original authorize URL or home
        window.location.href = next
      } else {
        const data = await response.json()
        setError(data.error || 'Invalid email or password')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full sm:max-w-md sm:bg-white sm:rounded-2xl sm:shadow-xl sm:border sm:border-slate-200 sm:p-8">
      <div className="text-center mb-8 sm:mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sign in to Newsworthy</h1>
        <p className="mt-2 text-base sm:text-sm text-gray-500">
          Enter your credentials to continue
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-gray-700">
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
              autoComplete="email"
              className="pl-12 sm:pl-10 h-14 sm:h-11 text-base sm:text-sm rounded-xl sm:rounded-lg border-gray-300 focus:border-cyan-600 focus:ring-cyan-600"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-gray-700">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-4 sm:w-4 text-gray-400" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              className="pl-12 sm:pl-10 pr-12 h-14 sm:h-11 text-base sm:text-sm rounded-xl sm:rounded-lg border-gray-300 focus:border-cyan-600 focus:ring-cyan-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
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
          className="w-full h-14 sm:h-11 text-base sm:text-sm font-semibold bg-cyan-800 text-white hover:bg-cyan-900 rounded-xl sm:rounded-lg transition-colors cursor-pointer"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 sm:h-4 sm:w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </Button>
      </form>
    </div>
  )
}
