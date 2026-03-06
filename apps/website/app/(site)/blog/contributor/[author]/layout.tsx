import '@/app/globals.css'
import Link from 'next/link'
import { getPages } from '@/sanity/sanity-utils'
import Image from 'next/image'

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return <main className='mx-auto'>{children}</main>
}
