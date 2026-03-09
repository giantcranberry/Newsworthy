'use client'

import posthog from 'posthog-js'
import { useSession } from 'next-auth/react'
import { useEffect, useRef } from 'react'

export function PostHogIdentify() {
  const { data: session } = useSession()
  const identified = useRef(false)

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

    if (session?.user && !identified.current) {
      posthog.identify(session.user.email ?? undefined, {
        email: session.user.email,
        name: session.user.name,
      })
      identified.current = true
    }
    if (!session?.user && identified.current) {
      posthog.reset()
      identified.current = false
    }
  }, [session])

  return null
}
