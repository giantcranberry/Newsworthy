'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImpersonationState {
  impersonating: boolean
  userId?: string
  userEmail?: string
  userName?: string
  adminId?: string
}

export function ImpersonationBanner() {
  const router = useRouter()
  const [state, setState] = useState<ImpersonationState | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const checkImpersonation = async () => {
      try {
        const response = await fetch('/api/admin/impersonate')
        const data = await response.json()
        setState(data)
      } catch (error) {
        console.error('Error checking impersonation:', error)
      }
    }

    checkImpersonation()
  }, [])

  const handleStopImpersonation = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'DELETE',
      })

      if (response.ok) {
        // Redirect back to admin users page
        router.push('/admin/users')
        router.refresh()
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
