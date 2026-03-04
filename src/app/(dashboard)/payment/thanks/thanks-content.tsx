'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2 } from 'lucide-react'

interface CreditBalance {
  prCredits: number
  yahooCredits: number
  enhancedCredits: number
}

interface ThanksContentProps {
  cartUuid: string | null
  userEmail: string
}

export function ThanksContent({ cartUuid, userEmail }: ThanksContentProps) {
  const [fulfilled, setFulfilled] = useState(false)
  const [balance, setBalance] = useState<CreditBalance | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const pollCount = useRef(0)

  useEffect(() => {
    if (!cartUuid || fulfilled) return

    const interval = setInterval(async () => {
      pollCount.current++

      // Stop polling after ~30 seconds (15 attempts at 2s intervals)
      if (pollCount.current > 15) {
        setTimedOut(true)
        clearInterval(interval)
        return
      }

      try {
        const res = await fetch(`/api/payment/cart-status?cart=${cartUuid}`)
        const data = await res.json()

        if (data.fulfilled) {
          setFulfilled(true)
          setBalance(data.balance)
          clearInterval(interval)
        }
      } catch {
        // Silently retry on network errors
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [cartUuid, fulfilled])

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Thank You!</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            An email receipt has been sent to {userEmail}.
          </p>

          {/* Credit Balances — only show once webhook has processed */}
          {!fulfilled && !timedOut && cartUuid && (
            <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 mb-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Updating your credit balance...</span>
            </div>
          )}

          {timedOut && !fulfilled && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
              Your payment was successful. Credits will appear on your dashboard shortly.
            </p>
          )}

          {fulfilled && balance && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{balance.prCredits}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">PR Credits</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{balance.yahooCredits}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Yahoo Credits</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{balance.enhancedCredits}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Enhanced Credits</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {fulfilled && balance && balance.prCredits > 0 && (
              <Link href="/pr/create">
                <Button className="w-full bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700">
                  Distribute a Press Release
                </Button>
              </Link>
            )}
            <Link href="/dashboard">
              <Button variant="outline" className="w-full">
                Go to Dashboard
              </Button>
            </Link>
            <Link href="/payment/paygo">
              <Button variant="outline" className="w-full">
                Buy More Credits
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
