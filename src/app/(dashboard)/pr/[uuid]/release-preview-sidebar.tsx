'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Monitor, Tablet, Smartphone } from 'lucide-react'
import { PreviewPanel } from '@/components/pr-wizard/preview-panel'
import { ResizeHandle } from '@/components/ui/resize-handle'
import { cn } from '@/lib/utils'

const MIN_WIDTH = 300
const MAX_WIDTH = 900
const DEFAULT_WIDTH = MAX_WIDTH

interface PreviewImage {
  id: number
  url: string
  title: string | null
  caption: string | null
  imgCredits: string | null
}

interface PreviewFaq {
  question: string
  answer: string
}

interface PreviewData {
  title: string | null
  abstract: string | null
  body: string | null
  pullquote: string | null
  location: string | null
  videoUrl: string | null
  companyName: string | null
  logoUrl: string | null
  bannerUrl: string | null
  images: PreviewImage[]
  faqs: PreviewFaq[]
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile'

function widthToDevice(width: number): DeviceMode {
  if (width <= 430) return 'mobile'
  if (width <= 768) return 'tablet'
  return 'desktop'
}

const DEVICE_SNAP_WIDTHS: Record<DeviceMode, number> = {
  desktop: MAX_WIDTH,
  tablet: 768,
  mobile: 375,
}

export function ReleasePreviewSidebar() {
  const { uuid } = useParams<{ uuid: string }>()
  const searchParams = useSearchParams()
  const isWizardComplete = searchParams.get('wizard') === 'complete'

  const [data, setData] = useState<PreviewData | null>(null)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingHighlightText = useRef<string | null>(null)

  const effectiveDevice = useMemo(() => widthToDevice(panelWidth), [panelWidth])

  const handleResize = useCallback((delta: number) => {
    setPanelWidth(prev => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, prev + delta)))
  }, [])

  const handleDeviceClick = useCallback((mode: DeviceMode) => {
    setPanelWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, DEVICE_SNAP_WIDTHS[mode])))
  }, [])

  const highlightText = useCallback((text: string) => {
    const container = scrollRef.current
    if (!container) return

    // Walk text nodes to find the matching text
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    const textNodes: { node: Text; start: number }[] = []
    let accumulated = ''
    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      textNodes.push({ node, start: accumulated.length })
      accumulated += node.textContent || ''
    }

    const matchIndex = accumulated.indexOf(text)
    if (matchIndex === -1) return

    const matchEnd = matchIndex + text.length
    let startNode: Text | null = null
    let startOffset = 0
    let endNode: Text | null = null
    let endOffset = 0

    for (const { node: tn, start } of textNodes) {
      const nodeEnd = start + (tn.textContent?.length || 0)
      if (!startNode && matchIndex >= start && matchIndex < nodeEnd) {
        startNode = tn
        startOffset = matchIndex - start
      }
      if (matchEnd > start && matchEnd <= nodeEnd) {
        endNode = tn
        endOffset = matchEnd - start
        break
      }
    }

    if (!startNode || !endNode) return

    const range = document.createRange()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)

    try {
      const mark = document.createElement('mark')
      mark.className = 'preview-highlight-flash'
      range.surroundContents(mark)
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
      mark.addEventListener('animationend', () => {
        // Unwrap the mark and restore original DOM
        const parent = mark.parentNode
        if (parent) {
          while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
          parent.removeChild(mark)
          parent.normalize()
        }
      }, { once: true })
    } catch {
      // Fallback if text spans multiple elements: highlight the parent block
      const el = startNode.parentElement
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('preview-highlight-flash')
        el.addEventListener('animationend', () => el.classList.remove('preview-highlight-flash'), { once: true })
      }
    }
  }, [])

  const fetchPreview = useCallback(() => {
    fetch(`/api/pr/${uuid}/preview?t=${Date.now()}`)
      .then((res) => res.ok ? res.json() : null)
      .then((d) => {
        setData(d)
        if (pendingHighlightText.current) {
          const text = pendingHighlightText.current
          pendingHighlightText.current = null
          // Wait for React to render new data before searching DOM
          requestAnimationFrame(() => highlightText(text))
        }
      })
      .catch(() => null)
  }, [uuid, highlightText])

  useEffect(() => {
    fetchPreview()
  }, [fetchPreview])

  // Re-fetch preview periodically and on explicit refresh events
  useEffect(() => {
    const handler = () => fetchPreview()
    const highlightHandler = (e: Event) => {
      const text = (e as CustomEvent<{ text: string }>).detail?.text
      if (text) {
        pendingHighlightText.current = text
        fetchPreview()
      }
    }
    window.addEventListener('preview-refresh', handler)
    window.addEventListener('preview-highlight', highlightHandler)
    const interval = setInterval(fetchPreview, 5000)
    return () => {
      window.removeEventListener('preview-refresh', handler)
      window.removeEventListener('preview-highlight', highlightHandler)
      clearInterval(interval)
    }
  }, [fetchPreview])

  // Hide sidebar on submission complete view (preview is shown inline)
  if (isWizardComplete) {
    return null
  }

  return (
    <div className="hidden xl:block shrink-0 -mt-6 -mr-6 -mb-6" style={{ width: panelWidth }}>
      <div className="sticky top-0 h-screen flex">
        <ResizeHandle onResize={handleResize} />
        <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto scrollbar-hide bg-white border-l border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Live Preview</h3>
            <p className="text-xs text-gray-600 mt-0.5">See how your press release will appear once published</p>
          </div>
          <div className="inline-flex items-center rounded-md border border-gray-300 bg-white shrink-0">
            {([
              { mode: 'desktop' as DeviceMode, icon: Monitor, label: 'Desktop' },
              { mode: 'tablet' as DeviceMode, icon: Tablet, label: 'Tablet' },
              { mode: 'mobile' as DeviceMode, icon: Smartphone, label: 'Mobile' },
            ]).map(({ mode, icon: Icon, label }, i) => (
              <button
                key={mode}
                onClick={() => handleDeviceClick(mode)}
                title={label}
                className={cn(
                  'inline-flex items-center px-2 py-1.5 cursor-pointer transition-colors',
                  i === 0 && 'rounded-l-md',
                  i === 2 && 'rounded-r-md',
                  i > 0 && 'border-l border-gray-300',
                  effectiveDevice === mode
                    ? 'bg-cyan-800/10 text-cyan-800'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
        <div>
          {data ? (
            <PreviewPanel
              release={{
                title: data.title,
                abstract: data.abstract,
                body: data.body,
                pullquote: data.pullquote,
                location: data.location,
                videoUrl: data.videoUrl,
              }}
              company={data.companyName ? {
                logoUrl: data.logoUrl,
                companyName: data.companyName,
              } : undefined}
              banner={data.bannerUrl ? { url: data.bannerUrl } : null}
              images={data.images?.length > 0 ? data.images : undefined}
              faqs={data.faqs?.length > 0 ? data.faqs : undefined}
              compact
              deviceMode={effectiveDevice}
            />
          ) : (
            <div className="p-4 space-y-4 animate-pulse">
              <div className="h-6 bg-gray-100 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
              <div className="space-y-2 mt-6">
                <div className="h-3 bg-gray-100 rounded" />
                <div className="h-3 bg-gray-100 rounded" />
                <div className="h-3 bg-gray-100 rounded w-5/6" />
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}
