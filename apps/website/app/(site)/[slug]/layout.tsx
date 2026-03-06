import '@/app/globals.css'
import Link from 'next/link'
import { Metadata } from 'next'
import { getPages } from '@/sanity/sanity-utils'
import Image from 'next/image'
import SearchBoxComponent from '@/components/search'

export const metadata: Metadata = {
  title: {
    default: 'Newsworthy.ai',
    template: `%s | Newsworthy.ai`,
  },
  description: 'Newsworthy.ai, The News Marketing Platform',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pages = await getPages()

  return (
    <div className="">
      <SearchBoxComponent />
      {children}
    </div>
  )
}
