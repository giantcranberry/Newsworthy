'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { LogIn, UserPlus } from 'lucide-react'

export function RegisterCTA({ action = 'post' }: { action?: string }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setIsLoggedIn(document.cookie.split(';').some(c => c.trim().startsWith('nw_sso=')))
  }, [])

  if (isLoggedIn) return null

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
      <UserPlus className="mx-auto h-8 w-8 text-gray-400 mb-2" />
      <p className="text-sm text-gray-600 mb-4">
        Participation in the Newsworthy.ai community requires a Newsworthy.ai account.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          href="https://app.newsworthyai.com/login"
          className="inline-flex items-center gap-2 rounded-md border border-cyan-700 px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-50 transition-colors"
        >
          <LogIn className="h-4 w-4" />
          Login
        </Link>
        <Link
          href="https://app.newsworthyai.com/register"
          className="inline-flex items-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Create Account - Free
        </Link>
      </div>
    </div>
  )
}
