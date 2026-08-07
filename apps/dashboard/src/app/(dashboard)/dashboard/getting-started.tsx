import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, CalendarClock } from 'lucide-react'

// Guided path shown on the dashboard until the user submits their first press
// release. Replaces the stats grid, which reads as a wall of zeros to a new
// user and offers no next action.

interface GettingStartedProps {
  // null = no brand yet; otherwise setup completeness through the newsroom
  brandSetup: {
    complete: boolean
    missing: { label: string; href: string }[]
    nextHref: string | null
  } | null
  // UUID of the user's brand, for the edit link once setup is complete
  brandUuid?: string | null
  hasDraft: boolean
  draftUuid: string | null
  // First incomplete wizard step of the draft, so the CTA resumes where the
  // user left off rather than restarting at Details
  draftNextHref?: string | null
  hasCredits: boolean
  // Live first-press-release-free eligibility (admin toggle + zero credits +
  // no press releases) — the finalize route waives the credit at submit
  firstReleaseFree?: boolean
}

type StepStatus = 'done' | 'active' | 'upcoming'

function StepBadge({ status, step }: { status: StepStatus; step: number }) {
  if (status === 'done') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
        <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
      </div>
    )
  }
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
        status === 'active'
          ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 ring-2 ring-cyan-600'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
      }`}
      aria-label={`Step ${step}`}
    >
      {step}
    </div>
  )
}

export function GettingStarted({ brandSetup, brandUuid, hasDraft, draftUuid, draftNextHref, hasCredits, firstReleaseFree = false }: GettingStartedProps) {
  const brandComplete = !!brandSetup?.complete
  const step1: StepStatus = brandComplete ? 'done' : 'active'
  const step2: StepStatus = hasDraft ? 'done' : brandComplete ? 'active' : 'upcoming'
  const step3: StepStatus = hasDraft ? 'active' : 'upcoming'

  return (
    <Card data-tour="dashboard-getting-started" className="border-cyan-600/40">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">Publish your first press release &mdash; on us!</CardTitle>
        <CardDescription className="text-base sm:text-lg">
          {firstReleaseFree ? (
            <>Three steps — and <strong className="font-bold text-gray-900 dark:text-gray-100">your first press release is on us.</strong></>
          ) : hasCredits ? (
            'Three steps — and you already have a credit ready to use.'
          ) : (
            'Three steps — drafting is free, and you only pay when you submit for review.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-6">
          <li className="flex gap-4">
            <StepBadge status={step1} step={1} />
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${step1 === 'active' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                {brandSetup && !brandComplete ? 'Complete your brand profile' : 'Create your brand profile'}
              </p>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                {brandSetup && !brandComplete
                  ? 'Work through each setup step — brand details, logo, PR contact, and newsroom — so your releases publish with your full brand presence.'
                  : 'Tell us about the company your news is about, then complete its profile — logo, PR contact, and newsroom.'}
              </p>
              {brandSetup && !brandComplete && brandSetup.missing.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {brandSetup.missing.map((item) => (
                    <li key={item.href + item.label}>
                      <Link
                        href={item.href}
                        className="text-sm text-cyan-800 dark:text-cyan-400 underline hover:text-cyan-900 dark:hover:text-cyan-300"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {step1 === 'active' && (
                <Button asChild className="mt-3 bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700">
                  <Link href={brandSetup ? brandSetup.nextHref || '/company' : '/company/add'}>
                    {brandSetup ? 'Continue brand setup' : 'Create your brand profile'}
                  </Link>
                </Button>
              )}
              {step1 === 'done' && brandUuid && (
                <Link
                  href={`/company/${brandUuid}`}
                  className="mt-1 inline-block text-sm text-cyan-800 dark:text-cyan-400 underline hover:text-cyan-900 dark:hover:text-cyan-300"
                >
                  Edit your brand
                </Link>
              )}
            </div>
          </li>

          <li className="flex gap-4">
            <StepBadge status={step2} step={2} />
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${step2 === 'active' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                Upload your press release
              </p>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                Draft with a live preview, images, and writing help. Writing is free — no credit
                needed until you&apos;re ready to publish.
              </p>
              {step2 === 'active' && (
                <Button asChild className="mt-3 bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700">
                  <Link href="/pr/create">Upload Your Release</Link>
                </Button>
              )}
            </div>
          </li>

          <li className="flex gap-4">
            <StepBadge status={step3} step={3} />
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${step3 === 'active' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                Submit &amp; publish &mdash; It&apos;s Free. Your First Press Release is Complimentary
              </p>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                {firstReleaseFree
                  ? 'Your first press release is free — submitting costs nothing. Our editors review your release and distribute it across the network.'
                  : hasCredits
                    ? 'Your first press release is free. No credit card required. Our editors review your release and distribute it across the network.'
                    : 'One payment at submission covers your press release credit. Our editors review your release and distribute it across the network.'}
              </p>
              {step3 === 'active' && (
                <Button asChild className="mt-3 bg-emerald-600 text-white hover:bg-emerald-700">
                  <Link href={draftNextHref ?? (draftUuid ? `/pr/${draftUuid}` : '/pr')}>Finish &amp; submit your release</Link>
                </Button>
              )}
            </div>
          </li>
        </ol>

        <div className="mt-8 flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50 p-4">
          <CalendarClock className="h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-400 mt-0.5" />
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Want a guided start?{' '}
            <a
              href="https://tidycal.com/newsmarketer/30-minute-meeting"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cyan-800 dark:text-cyan-400 underline hover:text-cyan-900 dark:hover:text-cyan-300"
            >
              Book a free 30-minute one-on-one onboarding call
            </a>{' '}
            and we&apos;ll walk through setup together.
          </p>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Watch: publish your first press release in under a minute
          </p>
          <div className="relative w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 aspect-video">
            <iframe
              src="https://www.youtube-nocookie.com/embed/y_Xx6o1O1Ts"
              title="Publish your first press release in under a minute"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Marketing-site-style promo for the News Marketing book, shown above the
// page header for users who haven't submitted their first release yet.
export function BookPromoBanner() {
  return (
    <div className="overflow-hidden rounded-xl bg-gradient-to-r from-[#5c0d18] via-[#8c1626] to-[#5c0d18]">
      <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
        <img
          src="/img/news-marketing-book.png"
          alt="News Marketing book by David A. McInnis"
          className="h-36 w-auto shrink-0 drop-shadow-lg sm:h-44"
        />
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-sm font-bold uppercase tracking-wide text-white">
            News Marketing
          </p>
          <p className="text-xs uppercase tracking-wide text-red-100/80">
            A 28-day system for AI visibility
          </p>
          <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">
            The 28-Day Discipline That Keeps Brands Findable
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-red-50/90">
            News Marketing is the practice of publishing one clear, well-structured release
            every 28 days and letting that rhythm build a permanent, searchable footprint
            your buyers can find.
          </p>
          <a
            href="https://newsmarketingbook.com/to/nwuser"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-900"
          >
            Get Your Free Copy
          </a>
        </div>
      </div>
    </div>
  )
}
