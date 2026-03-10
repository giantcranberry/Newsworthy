'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

export function RegisterBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setIsLoggedIn(document.cookie.split(';').some(c => c.trim().startsWith('nw_sso=')))
  }, [])

  if (dismissed || isLoggedIn) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-sm shadow-lg">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <p className="text-sm text-gray-700">
          <strong>Join the conversation</strong> &mdash; log in to Newsworthy.ai to post, comment, and connect.
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="https://app.newsworthyai.com/community"
            className="rounded-md bg-cyan-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-cyan-800 transition-colors"
          >
            Access
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
