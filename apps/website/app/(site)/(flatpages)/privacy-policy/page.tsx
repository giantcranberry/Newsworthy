import { getFlatPage } from '@/sanity/sanity-utils'
import { PortableText } from '@portabletext/react'
import Link from 'next/link'

export default async function PrivacyPolicy() {
  const page = await getFlatPage('privacy-policy')

  return (
    <div className='mx-auto w-full max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-10 py-5'>
      <div className='prose mx-auto mt-10 max-w-4xl prose-headings:font-serif prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-h4:text-xl prose-headings:font-normal prose-strong:font-bold'>
        <PortableText value={page.content} />

        <h2>Microsoft Clarity</h2>
        <p>
          We use Microsoft Clarity to understand how you use our website and apps.
          Clarity may collect usage data such as pages visited, clicks, scrolls,
          mouse movements, session recordings, heatmaps, device and browser
          information, and approximate location. We use this information to
          improve our products, user experience, and advertising.
        </p>
        <p>
          By using our site, you agree that we and Microsoft can collect and use
          this data as described in this Privacy Policy and in{' '}
          <Link
            href="https://privacy.microsoft.com/privacystatement"
            target="_blank"
            rel="noopener noreferrer"
          >
            Microsoft&apos;s Privacy Statement
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
