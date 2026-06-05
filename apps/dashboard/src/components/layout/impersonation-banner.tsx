'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { AlertTriangle, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImpersonationState {
  impersonating: boolean
  userId?: string
  userEmail?: string
  userName?: string
  adminId?: string
}

// Custom event other components dispatch to force an immediate re-check
// (e.g. right after starting/stopping impersonation).
export const IMPERSONATION_CHANGED_EVENT = 'impersonation-changed'

// Fallback poll so the banner self-heals if the cookie expires (4h) or
// impersonation is changed in another tab.
const POLL_INTERVAL_MS = 60_000

export function ImpersonationBanner() {
  const pathname = usePathname()
  const [state, setState] = useState<ImpersonationState | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const checkImpersonation = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/impersonate', { cache: 'no-store' })
      const data = await response.json()
      setState(data)
    } catch (error) {
      console.error('Error checking impersonation:', error)
    }
  }, [])

  // Re-check on mount and on every client-side navigation.
  useEffect(() => {
    checkImpersonation()
  }, [checkImpersonation, pathname])

  // Poll on an interval, re-check when the tab regains focus, and respond
  // immediately when impersonation is explicitly started/stopped.
  useEffect(() => {
    const interval = setInterval(checkImpersonation, POLL_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkImpersonation()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', checkImpersonation)
    window.addEventListener(IMPERSONATION_CHANGED_EVENT, checkImpersonation)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', checkImpersonation)
      window.removeEventListener(IMPERSONATION_CHANGED_EVENT, checkImpersonation)
    }
  }, [checkImpersonation])

  const handleStopImpersonation = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'DELETE',
      })

      if (response.ok) {
        // Hard redirect so session, sidebar, and banner all reset
        window.location.href = '/admin/users'
        return
      }
    } catch (error) {
      console.error('Error stopping impersonation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!state?.impersonating) {
    return null
  }

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">
          Impersonating: <strong>{state.userName || state.userEmail}</strong>
          {state.userEmail && state.userName !== state.userEmail && (
            <span className="opacity-80 ml-1">({state.userEmail})</span>
          )}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleStopImpersonation}
        disabled={isLoading}
        className="text-white hover:bg-amber-600 hover:text-white h-7"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <X className="h-4 w-4 mr-1" />
            Stop Impersonating
          </>
        )}
      </Button>
    </div>
  )
}
