'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle } from 'lucide-react'

export function AcceptInvite({ token, companyUuid }: { token: string; companyUuid: string }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAccept = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/company/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to accept invitation')
      }

      const data = await response.json()
      router.push(`/company/${data.companyUuid || companyUuid}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 p-3 rounded-lg mb-4">{error}</div>
      )}
      <Button
        onClick={handleAccept}
        disabled={isLoading}
        className="w-full gap-2 bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="h-4 w-4" />
        )}
        Accept Invitation
      </Button>
    </div>
  )
}
