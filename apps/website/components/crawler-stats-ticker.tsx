'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Search } from 'lucide-react'
import type { CrawlerStats24h } from '@/lib/crawler-stats'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const REFRESH_MS = 60_000

function formatCount(n: number) {
  return n.toLocaleString('en-US')
}

function StatsHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger
        type="button"
        aria-label="About AI training and search indexing stats"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15 text-sm font-bold text-amber-300 ring-1 ring-white/30 transition hover:bg-white/25 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        ?
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-semibold">
            About these stats
          </DialogTitle>
          <DialogDescription asChild>
            <div className="grid gap-6 text-left text-stone-900">
              <section className="grid gap-3">
                <h3 className="text-base font-semibold text-stone-950">
                  AI Training
                </h3>
                <p>
                  AI companies use automated crawlers to discover and access
                  content across the web that may be used to develop and improve
                  AI systems.{' '}
                  <a
                    href="https://newsworthy.ai"
                    className="font-bold text-stone-950 underline underline-offset-2 hover:text-indigo-700"
                  >
                    Newsworthy.ai
                  </a>{' '}
                  monitors this activity and tracks when recognized AI crawlers
                  access press releases published on our platform.
                </p>
                <p>
                  A crawl does not guarantee that content will ultimately be
                  included in an AI model&apos;s training data. But making your
                  news accessible and discoverable to the systems building the
                  next generation of AI starts with being where their crawlers
                  are looking.
                </p>
                <p className="font-bold text-stone-950">
                  In the AI era, distributing news means distributing it for
                  machines as well as people.
                </p>
              </section>
              <section className="grid gap-3">
                <h3 className="text-base font-semibold text-stone-950">
                  Search Indexing
                </h3>
                <p>
                  Search engines continuously crawl and index{' '}
                  <a
                    href="https://newsworthy.ai"
                    className="font-bold text-stone-950 underline underline-offset-2 hover:text-indigo-700"
                  >
                    Newsworthy.ai
                  </a>{' '}
                  press releases, making current company news discoverable
                  beyond the moment it is published.
                </p>
                <p>
                  That matters even more in the AI era. Search indexes and other
                  retrieval systems can help AI platforms find current
                  information when answering questions, allowing recently
                  published news to become part of the information ecosystem AI
                  can discover, retrieve, and potentially cite.
                </p>
                <p className="font-bold text-stone-950">
                  Your news can&apos;t be discovered if the systems looking for
                  it can&apos;t find it.
                </p>
              </section>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}

/** Dot-grid + glow artwork behind the bar. */
function BarArtwork() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <svg className="h-full w-full opacity-[0.18]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="crawler-stats-dots"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1.4" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#crawler-stats-dots)" />
      </svg>

      <div className="absolute -left-24 top-1/2 h-56 w-56 -translate-y-1/2 animate-pulse-glow rounded-full bg-fuchsia-500/40 blur-3xl" />
      <div className="absolute -right-24 top-1/2 h-56 w-56 -translate-y-1/2 animate-pulse-glow rounded-full bg-amber-400/30 blur-3xl" />

      <div className="absolute inset-y-0 -inset-x-1/3 animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent" />
    </div>
  )
}

/** Number that flashes amber for a beat whenever its value changes. */
function LiveNumber({ value }: { value: number }) {
  const [flash, setFlash] = useState(false)
  const previous = useRef(value)

  useEffect(() => {
    if (previous.current === value) return
    previous.current = value
    setFlash(true)
    const timer = setTimeout(() => setFlash(false), 900)
    return () => clearTimeout(timer)
  }, [value])

  return (
    <span
      className={[
        'relative ml-2 inline-flex items-center rounded-lg px-3 py-0.5 text-2xl font-black tabular-nums ring-1 transition-all duration-500 sm:text-3xl',
        flash
          ? 'scale-110 bg-amber-300 text-indigo-950 ring-amber-100 shadow-lg shadow-amber-400/40'
          : 'bg-white/10 text-amber-300 ring-white/20',
      ].join(' ')}
    >
      {formatCount(value)}
    </span>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <p className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-amber-300 ring-1 ring-white/25">
        {icon}
      </span>
      <span className="flex flex-wrap items-center text-base font-semibold tracking-tight text-indigo-50 sm:text-lg">
        {label}
        <LiveNumber value={value} />
      </span>
    </p>
  )
}

export function CrawlerStatsTicker({ initial }: { initial: CrawlerStats24h }) {
  const [stats, setStats] = useState(initial)

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      if (document.visibilityState === 'hidden') return
      try {
        const res = await fetch('/api/crawler-stats', { cache: 'no-store' })
        if (!res.ok) return
        const next = (await res.json()) as CrawlerStats24h
        if (!cancelled) setStats(next)
      } catch {
        // Keep showing the last good numbers on a failed poll.
      }
    }

    const interval = setInterval(refresh, REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  return (
    <div className="relative isolate overflow-hidden border-b-2 border-amber-400 bg-gradient-to-r from-indigo-800 via-violet-700 to-indigo-800 text-white shadow-lg shadow-indigo-900/30">
      <BarArtwork />

      <div className="relative mx-auto flex w-full max-w-screen-xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-3.5 xl:max-w-screen-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-3 py-1 text-xs font-black uppercase tracking-widest text-indigo-950 shadow-md shadow-amber-500/30">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-900 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-900" />
          </span>
          Live (Last 24 Hours)
        </span>

        <Stat
          icon={<Sparkles size={18} strokeWidth={2.5} />}
          label="AI Training Crawls"
          value={stats.aiHits}
        />

        <span className="hidden h-8 w-px bg-white/25 sm:block" aria-hidden />

        <Stat
          icon={<Search size={18} strokeWidth={2.5} />}
          label="Search Engine Crawls"
          value={stats.seoHits}
        />

        <StatsHelpDialog />
      </div>
    </div>
  )
}
