import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Newsworthy - Press Release Distribution',
  description: 'Distribute your press releases to major news outlets',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script
          src="https://kit.fontawesome.com/adf47b9acf.js"
          crossOrigin="anonymous"
          async
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
