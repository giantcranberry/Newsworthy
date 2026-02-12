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
        className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
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
      className="gap-1.5 text-gray-500 border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
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
