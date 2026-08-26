'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Fire-and-forget beacon for /news and /curated.
 * Server classifies User-Agent; only SEO/AI rows are stored.
 *
 * Note: many AI/SEO crawlers do not execute JS. Middleware also posts
 * to /api/page-hit for bot-like UAs so those visits are still logged.
 */
export function CrawlerHitBeacon() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname?.startsWith('/news') && !pathname?.startsWith('/curated')) {
      return
    }

    const pageUrl = window.location.href
    const body = JSON.stringify({ path: pathname, pageUrl })

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' })
        navigator.sendBeacon('/api/page-hit', blob)
        return
      }
    } catch {
      // fall through to fetch
    }

    void fetch('/api/page-hit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
