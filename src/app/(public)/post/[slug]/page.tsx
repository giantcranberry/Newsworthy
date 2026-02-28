import { db } from '@/db'
import { releaseEmails, releases } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import { ContactForm } from './contact-form'

const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY!

export default async function ContactPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Parse slug: format is "{md5Hash}-{prId}" — split on last hyphen
  const lastDash = slug.lastIndexOf('-')
  if (lastDash === -1) {
    notFound()
  }

  const md5Hash = slug.substring(0, lastDash)
  const prId = parseInt(slug.substring(lastDash + 1), 10)

  if (!md5Hash || isNaN(prId)) {
    notFound()
  }

  // Look up the email hash to verify it exists
  const emailRecord = await db.query.releaseEmails.findFirst({
    where: eq(releaseEmails.md5Hash, md5Hash),
  })

  if (!emailRecord) {
    notFound()
  }

  // Fetch the release with company info
  const release = await db.query.releases.findFirst({
    where: eq(releases.id, prId),
    with: {
      company: true,
    },
  })

  if (!release) {
    notFound()
  }

  const companyName = release.company?.companyName || ''
  const logoUrl = release.company?.logoUrl || null
  const releaseTitle = release.title || 'Untitled Press Release'

  // Build public press release URL
  let releaseUrl: string | null = null
  if (release.releasedAt && release.slug) {
    const d = new Date(release.releasedAt)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    releaseUrl = `https://www.newsworthy.ai/news/${y}${m}${day}${release.id}/${release.slug}`
  }

  return (
    <>
      <Script
        src={`https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_SITE_KEY}`}
        strategy="beforeInteractive"
      />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          {/* Header with company branding */}
          <div className="text-center mb-6">
            {logoUrl && (
              <img
                src={logoUrl}
                alt={companyName}
                className="h-12 mx-auto mb-4 object-contain"
              />
            )}
            <h1 className="text-2xl font-bold text-gray-900">Contact Us</h1>
            <p className="text-gray-600 mt-1">
              Regarding: <span className="font-medium">{releaseTitle}</span>
            </p>
            {companyName && (
              <p className="text-sm text-gray-500 mt-1">{companyName}</p>
            )}
          </div>

          <ContactForm slug={slug} releaseUrl={releaseUrl} recaptchaSiteKey={RECAPTCHA_SITE_KEY} />

          <p className="text-center mt-4 text-xs text-gray-400">
            <a href="https://www.newsworthy.ai/privacy-policy" className="hover:text-gray-600 underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          </p>
        </div>
      </div>
    </>
  )
}
