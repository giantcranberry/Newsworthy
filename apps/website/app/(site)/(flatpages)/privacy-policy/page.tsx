import { getFlatPage, getPage, urlFor } from '@/sanity/sanity-utils'
import { PortableText } from '@portabletext/react'
import Image from 'next/image'
import Link from 'next/link'

export default async function PrivacyPolicy() {
  const page = await getFlatPage('privacy-policy')

  return (
    <div className='mx-auto w-full xl:max-w-screen-xl px-5 lg:px-10 py-5'>
      <div className='prose mx-auto mt-10 max-w-4xl prose-headings:font-serif prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-h4:text-xl prose-headings:font-normal prose-strong:font-bold'>
        <PortableText value={page.content} />
      </div>
    </div>
  )
}
