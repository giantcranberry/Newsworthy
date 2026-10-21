'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { PostHogIdentify } from '@/components/posthog-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        forcedTheme="light"
        disableTransitionOnChange
        // next-themes renders an inline <script>; React 19.2 warns when one is
        // rendered on the client. The server-rendered script still runs on first
        // load, so mark it non-executable on the client.
        scriptProps={{ type: typeof window === 'undefined' ? 'text/javascript' : 'application/json' }}
      >
        <PostHogIdentify />
        {children}
      </ThemeProvider>
    </SessionProvider>
  )
}
