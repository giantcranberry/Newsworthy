import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/sonner'
import CrispChat from '@/components/crisp-chat'
import MicrosoftClarity from '@/components/microsoft-clarity'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Newsworthy - Press Release Distribution',
  description: 'Distribute your press releases to major news outlets',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          src="https://kit.fontawesome.com/adf47b9acf.js"
          crossOrigin="anonymous"
          async
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <MicrosoftClarity />
        <Providers>
          {children}
          <Toaster position="top-center" richColors />
          <CrispChat />
        </Providers>
      </body>
    </html>
  )
}
