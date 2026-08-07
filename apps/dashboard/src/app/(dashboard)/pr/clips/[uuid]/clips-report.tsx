'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ReportData, ClipRecord } from '@/services/report'
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Pie, Line, Bar } from 'react-chartjs-2'

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

// --- Helpers ---

/** Rewrite SVG/WebP image URLs to their PNG equivalents on cdn.newsramp.app */
function toPngUrl(url: string): string {
  if (!url) return url
  // Newsworthy logo special case
  if (url === 'https://www.newsworthy.ai/logo.svg') {
    return 'https://cdn.newsramp.app/logos/newsworthy-logo.png'
  }
  // Rewrite cdn1.newsworthy.ai SVG/WebP → cdn.newsramp.app PNG
  if (url.startsWith('https://cdn1.newsworthy.ai/') && /\.(svg|webp)$/i.test(url)) {
    return url
      .replace('https://cdn1.newsworthy.ai/', 'https://cdn.newsramp.app/')
      .replace(/\.(svg|webp)$/i, '.png')
  }
  // Rewrite cdn.newsramp.app SVG → PNG
  if (url.startsWith('https://cdn.newsramp.app/') && /\.svg$/i.test(url)) {
    return url.replace(/\.svg$/i, '.png')
  }
  return url
}

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatReleaseDateFull(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCityBuzzDate(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

function buildNewsUrl(release: ReportData['release']) {
  if (!release.releaseAt) return '#'
  const d = new Date(release.releaseAt)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `https://www.newsworthy.ai/news/${y}${m}${day}${release.id}/${release.slug}`
}

// --- Image with 404/load-error fallback ---
// If the image fails to load (404, broken URL, blocked), the <img> is removed
// from the DOM and `fallback` is rendered in its place instead of a broken icon.
function ReportImage({
  src,
  alt,
  className,
  fallback = null,
}: {
  src: string
  alt: string
  className?: string
  fallback?: React.ReactNode
}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <>{fallback}</>
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
}

// --- Logo Card (190x150, centered logo, shadow, no text label) ---
function LogoCard({ logo, name, link }: { logo: string; name: string; link?: string }) {
  const inner = (
    <div className="h-[150px] rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all flex items-center justify-center p-4 bg-white dark:bg-gray-900 cursor-pointer">
      <ReportImage
        src={logo}
        alt={name}
        className="max-w-full max-h-full w-auto h-auto object-contain min-w-[50px] min-h-[30px]"
        fallback={<span className="text-sm text-center block">{name}</span>}
      />
    </div>
  )
  if (link) {
    return (
      <div className="max-w-[190px]">
        <a href={link} target="_blank" rel="noopener noreferrer" className="block h-[150px] no-underline text-inherit">
          {inner}
        </a>
      </div>
    )
  }
  return <div className="max-w-[190px]">{inner}</div>
}

// --- Clip Card (distribution network: 48x48 logo, name, location, arrow) ---
function ClipCard({ clip }: { clip: ClipRecord }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:border-[#667eea] transition-all overflow-hidden">
      <a href={clip.link || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center p-3 gap-3 no-underline text-inherit">
        <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-gray-50 dark:bg-gray-950 rounded-md overflow-hidden">
          <ReportImage
            src={clip.logo || ''}
            alt={clip.name || ''}
            className="w-full h-full object-contain"
            fallback={
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white font-bold text-lg">
                {(clip.name || '?').trim().charAt(0).toUpperCase()}
              </div>
            }
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-700 dark:text-gray-300 text-[0.95rem] truncate">{clip.name}</div>
          {(clip.city || clip.state) && (
            <div className="text-[0.8rem] text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <i className="fa-solid fa-location-dot text-[0.7rem]" aria-hidden="true" />
              {[clip.city, clip.state].filter(Boolean).join(', ')}
            </div>
          )}
        </div>
        <div className="text-gray-300 text-[0.9rem] flex-shrink-0">
          <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
        </div>
      </a>
    </div>
  )
}

// --- Section Card ---
function SectionCard({ borderColor, children, className }: { borderColor: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-8 mb-8 border-l-4 ${borderColor} ${className || ''}`}>
      {children}
    </div>
  )
}

function SectionTitle({ icon, iconColor, children }: { icon: string; iconColor: string; children: React.ReactNode }) {
  return (
    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-3">
      <i className={`${icon} ${iconColor}`} aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}

// --- Circuit Clip Card (used in HR/Cannabis circuits - card with logo, name, city, state) ---
function CircuitClipCard({ thumbnail, name, link, city, state }: { thumbnail: string; name: string; link: string; city: string; state: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="p-4 flex items-center justify-center bg-gray-50 dark:bg-gray-950 min-h-[80px]">
        <ReportImage
          src={thumbnail}
          alt={name}
          className="max-w-[200px] w-full h-auto object-contain"
          fallback={<span className="text-sm font-medium text-gray-600 dark:text-gray-400">{name}</span>}
        />
      </div>
      <div className="p-3">
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{name}</a>
        {(city || state) && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{[city, state].filter(Boolean).join(', ')}</div>
        )}
      </div>
    </div>
  )
}

// --- Main Component ---
export function ClipsReport({ uuid, isPublic }: { uuid: string; isPublic: boolean }) {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'online' | 'isp' | 'market'>('online')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const refresh = params.get('refresh') === 'true'
    const qp = new URLSearchParams()
    if (isPublic) qp.set('public', 'true')
    if (refresh) qp.set('refresh', 'true')
    const qs = qp.toString()
    const url = `/api/pr/${uuid}/report${qs ? `?${qs}` : ''}`

    let retries = 0
    const maxRetries = 2

    const doFetch = (): Promise<void> =>
      fetch(url)
        .then(async (res) => {
          if (!res.ok) throw new Error('Failed to load report')
          const ct = res.headers.get('content-type') || ''
          if (!ct.includes('application/json')) {
            // CDN/proxy returned HTML (e.g. challenge page) — retry once
            if (retries < maxRetries) {
              retries++
              await new Promise((r) => setTimeout(r, 1500))
              return doFetch()
            }
            throw new Error('Unable to load report. Please refresh the page and try again.')
          }
          return res.json()
        })
        .then((d) => { if (d) setData(d) })
        .catch((e) => setError(e.message))

    doFetch().finally(() => setLoading(false))
  }, [uuid, isPublic])

  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [xlsGenerating, setXlsGenerating] = useState(false)

  const handleDownloadPdf = async () => {
    if (!data) return
    setPdfGenerating(true)
    try {
      const res = await fetch(`/api/pr/${uuid}/report/pdf`)
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `clip-report-${data.release.slug || uuid}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF download error:', err)
    } finally {
      setPdfGenerating(false)
    }
  }

  const handleDownloadXls = async () => {
    if (!data) return
    setXlsGenerating(true)
    try {
      const res = await fetch(`/api/pr/${uuid}/report/xls`)
      if (!res.ok) throw new Error('XLS generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `clip-report-${data.release.slug || uuid}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('XLS download error:', err)
    } finally {
      setXlsGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <i className="fa-solid fa-spinner fa-spin text-gray-400 text-3xl" aria-hidden="true" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-red-600 dark:text-red-400">{error || 'Report not found'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
        >
          <i className="fa-solid fa-rotate-right" aria-hidden="true" />
          Retry
        </button>
      </div>
    )
  }

  const { release, company, clips, totalPv, totalSh, ecpc, combStats, constGrowthStats, shStatsMultiplier, releaseIsYearOld, hasAdvGroup, nwrampReport, enhancedPublications, yahooFinanceUrls, circuits, encodedTitle, pdfDownloadCount } = data
  // May be missing on reports cached before this field existed
  const shareListCount = data.shareListCount ?? 0

  const marketClips = [...clips.fcmarkets, ...clips.marketminute]
  const hasDistNetwork = clips.gomedia.length > 0 || clips.synacor.length > 0 || marketClips.length > 0
  const hasCircuits = circuits.hr || circuits.cannabis || circuits.cannadelic || circuits.psychedelics
  const reportDate = new Date(data.fetchedAt).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' })

  return (
    <div data-report-ready className="max-w-[66.666%] mx-auto">
      {/* Header Bar */}
      <div className="pt-3 print:hidden">
        {!isPublic && (
          <Link href="/pr/" className="text-blue-600 dark:text-blue-400 hover:underline">
            <strong>&lsaquo;</strong> return to press release dashboard
          </Link>
        )}
        <div className="flex justify-between items-center mt-2">
          {!isPublic && (
            <a href={`/pr/clipsreport/${uuid}`} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
              Open public page
            </a>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadXls}
              disabled={xlsGenerating}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {xlsGenerating ? (
                <i className="fa-solid fa-spinner fa-spin text-green-600" aria-hidden="true" />
              ) : (
                <i className="fa-solid fa-file-excel text-green-600" aria-hidden="true" />
              )}
              {xlsGenerating ? 'Generating...' : 'Download XLS'}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfGenerating}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pdfGenerating ? (
                <i className="fa-solid fa-spinner fa-spin text-red-500" aria-hidden="true" />
              ) : (
                <i className="fa-solid fa-file-pdf text-red-500" aria-hidden="true" />
              )}
              {pdfGenerating ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
        </div>
        <hr className="my-4 border-gray-200 dark:border-gray-800" />
      </div>

      {/* Title Area: Logo + "Clipping Report" + Boost */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          {company.logoUrl && (
            <ReportImage
              src={company.logoUrl.includes('cdn.filestac') ? company.logoUrl.replace(/RESIZE/i, 'resize=width:300/output=format:png') : company.logoUrl}
              alt={company.companyName}
              className="max-h-[60px] max-w-[150px] object-contain mr-6"
            />
          )}
          <div>
            <h1 className="text-[2rem] font-bold text-gray-900 dark:text-gray-100 mb-0">Clipping Report</h1>
            <p className="text-gray-500 dark:text-gray-400 text-[0.95rem] mb-0">
              <i className="fa-solid fa-calendar-days mr-2" aria-hidden="true" />
              As of {reportDate}
            </p>
          </div>
        </div>
        <div className="print:hidden">
          <a
            href="https://newsworthy.ai/prboost"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-medium text-lg px-6 py-3 rounded-lg no-underline transition-colors"
          >
            <i className="fa-solid fa-rocket" aria-hidden="true" /> Boost Campaign
          </a>
        </div>
      </div>

      {/* Hero Section */}
      <div className="rounded-2xl bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white mb-4 overflow-hidden">
        <div className="p-6">
          <div className="flex flex-row items-center">
            {/* eCPC Column (25%) */}
            <div className="w-1/4 text-center border-r border-white/20 py-3">
              <i className="fa-solid fa-trophy text-4xl mb-3 opacity-90 block" aria-hidden="true" />
              <h1 className="text-6xl font-bold mb-2 text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>${ecpc}</h1>
              <h5 className="text-white opacity-95 font-medium mb-2">Effective CPC</h5>
              <small className="block opacity-85">Based on standard distribution</small>
            </div>
            {/* Release Info Column (75%) */}
            <div className="w-3/4 pl-6">
              <h3 className="text-xl font-semibold text-white mb-3">
                <a href={buildNewsUrl(release)} target="_blank" rel="noopener noreferrer" className="text-white no-underline hover:underline">
                  {release.title}
                </a>
              </h3>
              <div className="mb-2 opacity-95">
                {release.location && (
                  <>
                    <i className="fa-solid fa-location-dot mr-2" aria-hidden="true" />
                    {release.location.toUpperCase()}
                    <span className="mx-2">&bull;</span>
                  </>
                )}
                <i className="fa-solid fa-calendar mr-2" aria-hidden="true" />
                {formatReleaseDateFull(release.releasedAt)}
              </div>
              {release.abstract && (
                <p className="mb-0 opacity-90 text-[1.05rem] leading-relaxed">{release.abstract}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 items-stretch">
        {/* Total Views */}
        <div className="rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all bg-white dark:bg-gray-900">
          <div className="text-center py-6 flex flex-col justify-center items-center">
            <i className="fa-solid fa-eye text-blue-600 dark:text-blue-400 mb-3 text-[2rem]" aria-hidden="true" />
            <div className="text-[2.5rem] font-bold text-gray-900 dark:text-gray-100 leading-none">{totalPv.toLocaleString()}</div>
            <div className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 opacity-80 mt-2">Total Views</div>
          </div>
        </div>
        {/* Total Shares — the zero state invites the user to build a share list instead of showing a 0 */}
        <div className="rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all bg-white dark:bg-gray-900">
          {totalSh > 0 ? (
            <div className="text-center py-6 flex flex-col justify-center items-center">
              <i className="fa-solid fa-share-nodes text-green-500 mb-3 text-[2rem]" aria-hidden="true" />
              <div className="text-[2.5rem] font-bold text-gray-900 dark:text-gray-100 leading-none">{totalSh.toLocaleString()}</div>
              <div className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 opacity-80 mt-2">Total Shares</div>
            </div>
          ) : shareListCount === 0 ? (
            <div className="text-center py-6 px-4 flex flex-col justify-center items-center h-full">
              <i className="fa-solid fa-share-nodes text-gray-300 mb-3 text-[2rem]" aria-hidden="true" />
              <div className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 opacity-80">Share List Not Activated</div>
              {!isPublic && (
                <Link
                  href={`/company/${company.uuid}/advocacy`}
                  className="mt-2 text-sm font-semibold text-cyan-700 dark:text-cyan-400 underline hover:text-cyan-900 dark:hover:text-cyan-300"
                >
                  Activate Now
                </Link>
              )}
            </div>
          ) : (
            <div className="text-center py-6 px-4 flex flex-col justify-center items-center h-full">
              <i className="fa-solid fa-share-nodes text-gray-300 mb-3 text-[2rem]" aria-hidden="true" />
              <div className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 opacity-80">No Share Stats Yet</div>
              {!isPublic && (
                <Link
                  href={`/company/${company.uuid}/advocacy`}
                  className="mt-2 text-sm font-semibold text-cyan-700 dark:text-cyan-400 underline hover:text-cyan-900 dark:hover:text-cyan-300"
                >
                  Grow your Share List
                </Link>
              )}
            </div>
          )}
        </div>
        {/* AIO / SEO */}
        <div className="md:col-span-2 rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all bg-white dark:bg-gray-900">
          <div className="text-center py-4 flex flex-col justify-center items-center">
            <div className="flex justify-center items-center gap-5 mb-3">
              <img src="/img/ai/openai.svg" alt="OpenAI" className="h-7 w-auto opacity-85" />
              <img src="/img/ai/gemini.svg" alt="Google Gemini" className="h-7 w-auto opacity-85" />
              <img src="/img/ai/google.svg" alt="Google" className="h-7 w-auto opacity-85" />
            </div>
            <div className="text-[1.4rem] font-bold text-gray-900 dark:text-gray-100">AIO / SEO?</div>
            <div className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 opacity-80 mt-1">We&apos;ve got you covered.</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 mb-0 leading-tight">
              Your Press Release is optimized for AI and Search.
            </p>
          </div>
        </div>
      </div>

      {/* 1.182 Billion Alert */}
      <div className="rounded-lg border-l-4 border-l-blue-600 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-4 mb-6">
        <h5 className="text-blue-600 dark:text-blue-400 mb-2 font-semibold">
          <i className="fa-solid fa-lightbulb mr-2" aria-hidden="true" />1.182 Billion
        </h5>
        <p className="text-gray-500 dark:text-gray-400 mb-0 text-sm">With our Newsramp distribution we now reach an audience of more than 1.182 billion in their native language.</p>
      </div>

      {/* Performance Analytics */}
      <div className="mt-8">
        <div className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-3">
          <i className="fa-solid fa-chart-line text-blue-600 dark:text-blue-400 text-xl" aria-hidden="true" />
          <span>Performance Analytics</span>
        </div>

        {combStats.length > 0 && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              {/* Engagement Summary (col-lg-4 = 1/3) */}
              <div className="rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] bg-white dark:bg-gray-900 h-full">
                <div className="p-5">
                  <h6 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Engagement Summary</h6>
                  {/* Metric rows */}
                  <div className="space-y-0">
                    <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                        <i className="fa-solid fa-eye text-blue-600 dark:text-blue-400" aria-hidden="true" /> Total Views
                      </div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg mb-0">{totalPv.toLocaleString()}</h4>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                        <i className="fa-solid fa-share-nodes text-green-500" aria-hidden="true" /> Total Shares
                      </div>
                      {totalSh > 0 ? (
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg mb-0">{totalSh.toLocaleString()}</h4>
                      ) : (
                        <span className="text-sm text-gray-400">No Share Stats Yet</span>
                      )}
                    </div>
                    <div className={`flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-800`}>
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                        <i className="fa-solid fa-mouse-pointer text-amber-500" aria-hidden="true" /> Other Engagements
                      </div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg mb-0">0</h4>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                        <i className="fa-solid fa-file-pdf text-red-500" aria-hidden="true" /> PDF Downloads
                      </div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg mb-0">{pdfDownloadCount.toLocaleString()}</h4>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                        <i className="fa-solid fa-users text-cyan-500" aria-hidden="true" /> Total Engagement
                      </div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg mb-0">{(totalPv + totalSh).toLocaleString()}</h4>
                    </div>
                  </div>
                  {/* Pie Chart */}
                  {(totalPv > 0 || totalSh > 0) && (
                    <div className="h-[200px] mt-4">
                      <Pie
                        data={{
                          labels: ['Views', 'Shares'],
                          datasets: [{
                            data: [totalPv, totalSh],
                            backgroundColor: ['#3b82f6', '#22c55e'],
                            borderWidth: 1,
                          }],
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Cumulative Growth (col-lg-8 = 2/3) */}
              <div className="lg:col-span-2 rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] bg-white dark:bg-gray-900">
                <div className="p-5">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h6 className="font-semibold text-gray-800 dark:text-gray-200">Cumulative Growth</h6>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Track your content&apos;s momentum over time</p>
                    </div>
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5 text-gray-500 dark:text-gray-400">UTC</span>
                  </div>
                  <div className="h-[400px]">
                    <Line
                      data={{
                        labels: constGrowthStats.map((s) => s.key_as_string),
                        datasets: [
                          {
                            label: 'Views',
                            data: constGrowthStats.map((s) => s.views),
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59,130,246,0.1)',
                            fill: true,
                            tension: 0.3,
                          },
                          {
                            label: shStatsMultiplier > 1 ? `Shares (x${shStatsMultiplier})` : 'Shares',
                            data: constGrowthStats.map((s) => s.shares_multiplied ?? s.shares),
                            borderColor: '#22c55e',
                            backgroundColor: 'rgba(34,197,94,0.1)',
                            fill: true,
                            tension: 0.3,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { x: { ticks: { maxTicksLimit: 10, font: { size: 10 } } } },
                        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Activity (hidden if >1 year old) */}
            {!releaseIsYearOld && (
              <div className="rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] bg-white dark:bg-gray-900 mb-4">
                <div className="p-5">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h6 className="font-semibold text-gray-800 dark:text-gray-200">Daily Activity</h6>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Day-by-day breakdown of views and shares</p>
                    </div>
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5 text-gray-500 dark:text-gray-400">UTC</span>
                  </div>
                  <div className="h-[400px]">
                    <Bar
                      data={{
                        labels: combStats.map((s) => s.key_as_string),
                        datasets: [
                          {
                            label: 'Views',
                            data: combStats.map((s) => s.views),
                            backgroundColor: '#3b82f6',
                          },
                          {
                            label: shStatsMultiplier > 1 ? `Shares (x${shStatsMultiplier})` : 'Shares',
                            data: combStats.map((s) => s.shares_multiplied ?? s.shares),
                            backgroundColor: '#22c55e',
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { x: { ticks: { maxTicksLimit: 12, font: { size: 10 } } } },
                        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Advocacy Group Alert */}
        {hasAdvGroup ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-start gap-3 mb-4">
            <i className="fa-solid fa-check-circle text-green-600 dark:text-green-400 text-2xl mt-0.5" aria-hidden="true" />
            <div>
              <h6 className="font-semibold text-green-800 dark:text-green-400 mb-1">Share List Active</h6>
              <p className="text-sm text-green-700 dark:text-green-400 mb-2">Your share list is helping amplify your message. Keep engaging with your network to maximize your reach.</p>
              <a href="/company/advocacy" className="inline-flex items-center gap-1.5 bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 no-underline">
                Manage Share List
              </a>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 mb-4">
            <i className="fa-solid fa-triangle-exclamation text-amber-500 text-2xl mt-0.5" aria-hidden="true" />
            <div>
              <h6 className="font-semibold text-amber-800 dark:text-amber-400 mb-1">Boost Your Reach with Share Lists</h6>
              <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">You&apos;re missing out on one of our most powerful FREE marketing tools. Set up a share list to amplify your message through your network.</p>
              <a href="/company/advocacy" className="inline-flex items-center gap-1.5 bg-amber-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-amber-600 no-underline">
                Setup Share List
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Section Divider */}
      <div className="h-0.5 my-12 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      {/* Blockchain Verification */}
      {nwrampReport && nwrampReport.blockchain_qrcode && (
        <SectionCard borderColor="border-l-[#764ba2]">
          <SectionTitle icon="fa-solid fa-link" iconColor="text-[#764ba2]">Blockchain Verification</SectionTitle>
          <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">Immutable proof of publication secured on the blockchain</p>
          <div className="text-center">
            <ReportImage src={nwrampReport.blockchain_qrcode} alt="Blockchain QR Code" className="max-w-[250px] inline-block" />
          </div>
        </SectionCard>
      )}

      {/* Search & News Portals */}
      <SectionCard borderColor="border-l-[#667eea]">
        <SectionTitle icon="fa-solid fa-globe" iconColor="text-blue-600 dark:text-blue-400">Search &amp; News Portals</SectionTitle>
        <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">Your press release is discoverable across major search engines and news aggregators</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
          <LogoCard logo="/img/logos/google.png" name="Google" link={`https://google.com/search?q=${encodedTitle}`} />
          <LogoCard logo="/img/logos/microsoft.jpg" name="Microsoft Bing" link={`https://bing.com/search?q=${encodedTitle}`} />
          <LogoCard logo="https://cdn.newsramp.app/logos/duckduckgo.png" name="DuckDuckGo" link={`https://duckduckgo.com/?q=${encodedTitle}&t=h_&ia=web`} />
          <LogoCard logo="/img/logos/citybuzz.png" name="CityBuzz" link={`https://www.citybuzz.co/${formatCityBuzzDate(release.releasedAt)}/${release.slug}/`} />
          {yahooFinanceUrls.map((url, i) => (
            <LogoCard key={`yahoo-${i}`} logo="https://cdn.newsramp.app/newsworthy/yahoo_news_1.jpg" name="Yahoo Finance" link={url} />
          ))}
          {clips.streetinsiderUrl && (
            <LogoCard logo="https://cdn.newsramp.app/logos/streetinsider.png" name="StreetInsider" link={clips.streetinsiderUrl} />
          )}
          <LogoCard logo="https://cdn.newsramp.app/logos/Ground_News.png" name="Ground News" link={`https://ground.news/article/${release.slug}`} />
        </div>
      </SectionCard>

      {/* Enhanced Distribution */}
      {enhancedPublications.length > 0 && (
        <SectionCard borderColor="border-l-[#667eea]">
          <SectionTitle icon="fa-solid fa-bullhorn" iconColor="text-blue-600 dark:text-blue-400">Enhanced Distribution</SectionTitle>
          <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">Representative distribution sample. Showing {Math.min(36, enhancedPublications.length)} of {enhancedPublications.length} endpoints. Some of the endpoints below require publication subscriptions that prevent linking directly to your press release.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
            {enhancedPublications.slice(0, 36).map((pub, i) => (
              <LogoCard key={i} logo={toPngUrl(pub.logo_url)} name={pub.name} link={pub.link || undefined} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Newsramp Boostify */}
      {nwrampReport && (
        <SectionCard borderColor="border-l-green-500">
          <SectionTitle icon="fa-solid fa-rocket" iconColor="text-green-500">Newsramp Boostify&trade; Circuit</SectionTitle>
          <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">Extended distribution network amplifying your message across specialized platforms</p>

          {/* Placements + Social Cards in same grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 mb-6">
            {nwrampReport.placements && nwrampReport.placements.filter((p: any) => p.placement !== 'https://newswriter.ai/news').map((p: any, i: number) => {
              const logoUrl = p.logo && p.logo.includes('http')
                ? toPngUrl(p.logo)
                : `https://cdn1.newsworthy.ai/images/clip_report/newsramp/${(p.placement || '').split('.')[0]}.png`
              return <LogoCard key={`pl-${i}`} logo={logoUrl} name={p.placement?.split('.')[0] || ''} link={p.url || undefined} />
            })}

            {/* Social media cards (same card format) */}
            {nwrampReport.linkedin && (
              <LogoCard logo="https://cdn1.newsworthy.ai/images/clip_report/newsramp/linkedin.png" name="LinkedIn" link={nwrampReport.linkedin} />
            )}
            {nwrampReport.telegram_posts && nwrampReport.telegram_posts.length > 0 && (
              <LogoCard logo="https://cdn1.newsworthy.ai/images/clip_report/newsramp/telegram.png" name="Telegram" link={nwrampReport.telegram_posts[0]} />
            )}
            {nwrampReport.bluesky && (
              <LogoCard logo="https://cdn.newsramp.app/bluesky.png" name="Bluesky" link={nwrampReport.bluesky} />
            )}
            {nwrampReport.mastodon && (
              <LogoCard logo="https://cdn.newsramp.app/mastodon.png" name="Mastodon" link={nwrampReport.mastodon} />
            )}
            {nwrampReport.github && (
              <LogoCard logo="https://cdn.newsramp.app/images/clip_report/newsramp/github.png" name="GitHub" link={nwrampReport.github} />
            )}
            {nwrampReport.substack && (
              <LogoCard logo="https://cdn1.newsworthy.ai/images/clip_report/newsramp/substack.png" name="Substack" link={nwrampReport.substack} />
            )}
          </div>

          {/* Podcasts */}
          {nwrampReport.podcasts && nwrampReport.podcasts.length > 0 && (
            <div className="mt-8">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 pt-3 mb-2">Podcasts</h4>
              <hr className="mb-4 border-gray-200 dark:border-gray-800" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 mb-6">
                {nwrampReport.podcasts.map((podcast: any, i: number) => (
                  <div key={i} className="max-w-[190px]">
                    <a href={`https://newsramp.com/podcasts/${podcast.podcast}`} target="_blank" rel="noopener noreferrer" className="block h-[150px] no-underline text-inherit">
                      <div className="h-[150px] rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all flex items-center justify-center p-2.5 bg-white dark:bg-gray-900 cursor-pointer">
                        {podcast.artwork && (
                          <ReportImage src={podcast.artwork} alt={podcast.title || 'Podcast'} className="max-w-[120px] max-h-[120px] w-auto h-auto object-contain rounded-lg" fallback={<span className="text-xs text-center text-gray-600 dark:text-gray-400 px-2">{podcast.title || 'Podcast'}</span>} />
                        )}
                      </div>
                    </a>
                  </div>
                ))}
              </div>

              {/* Listen On Badges */}
              <h5 className="font-bold text-gray-900 dark:text-gray-100 pt-3 mb-3">Listen On:</h5>
              <div className="flex items-center flex-wrap gap-4">
                <img src="https://cdn.newsramp.app/badges/apple-badge.png" width={150} alt="Listen on Apple Podcasts" />
                <img src="https://cdn.newsramp.app/badges/iheart-badge.png" width={150} alt="Listen on iHeart Radio" />
                <img src="https://cdn.newsramp.app/badges/spotify-badge.png" width={150} alt="Listen on Spotify" />
                <img src="https://cdn.newsramp.app/badges/pandora-badge.png" width={150} alt="Listen on Pandora" />
                <img src="https://cdn.newsramp.app/badges/youtube-badge.png" width={150} alt="Listen on YouTube" />
                <img src="https://cdn.newsramp.app/badges/castbox-badge.png" width={150} alt="Listen on Castbox" />
                <img src="https://cdn.newsramp.app/badges/android-badge.png" width={150} alt="Listen on Android" />
                <img src="https://cdn.newsramp.app/badges/podcast-index-badge.png" width={150} alt="Listen on PodcastIndex" />
                <img src="https://cdn.newsramp.app/badges/deezer.png" width={150} alt="Listen on Deezer" />
              </div>
            </div>
          )}

          {/* Language Translations */}
          {nwrampReport.translations && nwrampReport.translations.length > 0 && (
            <div className="mt-8">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 pt-3 mb-2">Language Translations</h4>
              <hr className="mb-4 border-gray-200 dark:border-gray-800" />
              <div className="flex items-center flex-wrap gap-1">
                {nwrampReport.translations.map((t: any, i: number) => {
                  const entries = Object.entries(t)
                  if (entries.length === 0) return null
                  const [langName, langLink] = entries[0]
                  return (
                    <a
                      key={i}
                      href={langLink as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-[1.2rem] text-blue-600 dark:text-blue-400 hover:underline mr-4 mb-2"
                    >
                      <img
                        src={`https://cdn.newsramp.app/images/clip_report/translations/${langName.replace(/ /g, '-')}.png`}
                        width={35}
                        height={35}
                        alt={langName}
                        className="mr-2"
                      />
                      {langName}
                    </a>
                  )
                })}
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* Subscription Research Databases */}
      <SectionCard borderColor="border-l-cyan-500">
        <SectionTitle icon="fa-solid fa-database" iconColor="text-cyan-500">Subscription Research Databases</SectionTitle>
        <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">Your content is indexed in premium research and analytics platforms</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
          <LogoCard logo="https://cdn.newsramp.app/images/clip_report/gale.png" name="Gale" link="https://www.gale.com" />
          <LogoCard logo="https://cdn.newsramp.app/images/clip_report/lexis-nexis.png" name="LexisNexis" link="https://www.lexisnexis.com/en-us/gateway.page" />
          <LogoCard logo="https://cdn.newsramp.app/images/clip_report/moodys.png" name="Moody's Analytics" link="https://www.moodysanalytics.com" />
          <LogoCard logo="https://cdn.newsramp.app/images/clip_report/pro-quest.png" name="ProQuest" link="https://www.proquest.com" />
          <LogoCard logo="https://cdn.newsramp.app/images/clip_report/refinitive.png" name="Refinitiv / LSEG" link="https://www.lseg.com/en/data-analytics" />
          <LogoCard logo="https://cdn.newsramp.app/images/clip_report/thomson-reuters.png" name="Thomson Reuters" link="https://www.thomsonreuters.com/en.html" />
        </div>
      </SectionCard>

      {/* Specialized Circuits */}
      {hasCircuits && (
        <SectionCard borderColor="border-l-pink-500">
          <SectionTitle icon="fa-solid fa-broadcast-tower" iconColor="text-pink-500">Specialized Circuits</SectionTitle>
          <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">Targeted distribution to industry-specific platforms and communities</p>

          {/* HR Circuit */}
          {circuits.hr && (
            <div className="mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <CircuitClipCard
                  thumbnail="https://cdn1.newsworthy.ai/images/clipreport/circuits/hcmtechnologyreport.jpg"
                  name="HCM Technology Report"
                  link={`https://www.hcmtechnologyreport.com/${release.slug}`}
                  city="Shelton" state="CT"
                />
                <CircuitClipCard
                  thumbnail="https://cdn1.newsworthy.ai/images/clipreport/circuits/talentculture.png"
                  name="TalentCulture"
                  link={`https://www.talentculture.com/${release.slug}`}
                  city="Portland" state="OR"
                />
                <CircuitClipCard
                  thumbnail="https://cdn1.newsworthy.ai/images/clipreport/circuits/hrtechalliances.png"
                  name="HR Tech Alliances"
                  link={`https://www.hrtechalliances.com/wordpress/${release.slug}`}
                  city="West Chester" state="PA"
                />
                <CircuitClipCard
                  thumbnail="https://cdn1.newsworthy.ai/images/clipreport/circuits/hrotoday.png"
                  name="HRO Today"
                  link="https://www.hrotoday.com/hr-industry-news"
                  city="Philadelphia" state="PA"
                />
                <CircuitClipCard
                  thumbnail="https://cdn1.newsworthy.ai/images/clipreport/circuits/hrmarketer.png"
                  name="HR Marketer"
                  link="https://hrmarketer.com"
                  city="Aptos" state="CA"
                />
                <CircuitClipCard
                  thumbnail="https://cdn1.newsworthy.ai/images/clipreport/circuits/reddit.png"
                  name="HR News on Reddit"
                  link={circuits.data.reddit && circuits.data.reddit.link ? circuits.data.reddit.link : 'https://www.reddit.com/r/HRnews'}
                  city="San Francisco" state="CA"
                />
                {circuits.data.hrtechfeed && (
                  <CircuitClipCard
                    thumbnail="https://cdn1.newsworthy.ai/images/clipreport/circuits/hrtechfeed.png"
                    name="HR Tech Feed"
                    link={circuits.data.hrtechfeed.link || 'https://hrtechfeed.com/press-releases'}
                    city="Trumbull" state="CT"
                  />
                )}
              </div>
            </div>
          )}

          {/* Cannabis/Cannadelic/Psychedelics Circuit */}
          {(circuits.cannabis || circuits.cannadelic || circuits.psychedelics) && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {circuits.data.weedweek && (
                  <CircuitClipCard
                    thumbnail="https://cdn1.newsworthy.ai/images/clipreport/circuits/weedweek.png"
                    name="WeedWeek"
                    link={`https://www.weedweek.com/${release.slug}`}
                    city="Long Beach" state="CA"
                  />
                )}
                <CircuitClipCard
                  thumbnail="https://cdn1.newsworthy.ai/images/clipreport/circuits/axiswire.png"
                  name="AxisWire"
                  link={`https://www.axiswire.com/${release.slug}`}
                  city="Santa Monica" state="CA"
                />
                <CircuitClipCard
                  thumbnail="https://cdn1.newsworthy.ai/images/clipreport/circuits/cannabisradio.png"
                  name="Cannabis Radio"
                  link="https://www.cannabisradio.com"
                  city="Scottsdale" state="AZ"
                />
                <CircuitClipCard
                  thumbnail="https://cdn1.newsworthy.ai/images/clipreport/circuits/reddit.png"
                  name="Cannabis News on Reddit"
                  link={circuits.data.reddit && circuits.data.reddit.link ? circuits.data.reddit.link : 'https://www.reddit.com/r/CannabisNewsInfo'}
                  city="San Francisco" state="CA"
                />
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* Distribution Network */}
      {hasDistNetwork && (
        <>
          <div className="h-0.5 my-12 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

          <div className="mb-8">
            <div className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-3">
              <i className="fa-solid fa-network-wired text-blue-600 dark:text-blue-400 text-xl" aria-hidden="true" />
              <span>Distribution Network</span>
            </div>

            <div className="rounded-lg border-l-4 border-l-cyan-500 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-4 mb-4">
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-0">
                <i className="fa-solid fa-info-circle mr-2" aria-hidden="true" />
                Representative sampling of your distribution network. Your release reaches hundreds of additional endpoints through our syndication partners.
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-4 mb-6 border-b-2 border-gray-200 dark:border-gray-800 overflow-x-auto">
              {clips.gomedia.length > 0 && (
                <button
                  onClick={() => setActiveTab('online')}
                  className={`py-3 px-6 font-semibold text-sm border-b-[3px] -mb-[2px] transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'online'
                      ? 'text-[#667eea] border-[#667eea]'
                      : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300'
                  }`}
                >
                  <i className="fa-solid fa-globe mr-2" aria-hidden="true" />Online Sources
                  <span className={`inline-block ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === 'online' ? 'bg-[#667eea] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}>{clips.gomedia.length}</span>
                </button>
              )}
              {clips.synacor.length > 0 && (
                <button
                  onClick={() => setActiveTab('isp')}
                  className={`py-3 px-6 font-semibold text-sm border-b-[3px] -mb-[2px] transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'isp'
                      ? 'text-[#667eea] border-[#667eea]'
                      : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300'
                  }`}
                >
                  <i className="fa-solid fa-wifi mr-2" aria-hidden="true" />ISP Portals
                  <span className={`inline-block ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === 'isp' ? 'bg-[#667eea] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}>{clips.synacor.length}</span>
                </button>
              )}
              {marketClips.length > 0 && (
                <button
                  onClick={() => setActiveTab('market')}
                  className={`py-3 px-6 font-semibold text-sm border-b-[3px] -mb-[2px] transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'market'
                      ? 'text-[#667eea] border-[#667eea]'
                      : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300'
                  }`}
                >
                  <i className="fa-solid fa-chart-line mr-2" aria-hidden="true" />Market Sources
                  <span className={`inline-block ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === 'market' ? 'bg-[#667eea] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}>{marketClips.length}</span>
                </button>
              )}
            </div>

            {/* Tab Content - clips grid */}
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {activeTab === 'online' && clips.gomedia.map((c) => <ClipCard key={c.id} clip={c} />)}
              {activeTab === 'isp' && clips.synacor.map((c) => <ClipCard key={c.id} clip={c} />)}
              {activeTab === 'market' && marketClips.map((c) => <ClipCard key={c.id} clip={c} />)}
            </div>
          </div>
        </>
      )}

      {/* Brand Footer */}
      {company.logoUrl && (
        <div className="flex justify-center py-6 print:hidden">
          <img
            src={company.logoUrl.includes('cdn.filestac') ? company.logoUrl.replace(/RESIZE/i, 'resize=width:263/output=format:png') : company.logoUrl}
            alt={company.companyName}
            className="max-h-[60px] max-w-[180px] object-contain opacity-60"
          />
        </div>
      )}
    </div>
  )
}
