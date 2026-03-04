'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, Clock } from 'lucide-react'

export function VerifyButton({
  userId,
  verified,
}: {
  userId: number
  verified: boolean
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleToggle = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailVerified: !verified }),
      })
      if (res.ok) {
        router.refresh()
      }
    } catch {
      // silently fail — the page will still show the current state
    } finally {
      setIsLoading(false)
    }
  }

  if (verified) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={isLoading}
        className="gap-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 hover:bg-green-50 cursor-pointer"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        Verified
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={isLoading}
      className="gap-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 hover:bg-yellow-50 cursor-pointer"
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Clock className="h-3.5 w-3.5" />
      )}
      Pending
    </Button>
  )
}
