'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users,
  Newspaper,
  Building2,
  Settings,
  ImageIcon,
  ArrowLeft,
  Code,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CompanyNavProps {
  companyUuid: string
  companyName: string
}

const NAV_ITEMS = [
  { label: 'Edit Brand', href: '', icon: Building2 },
  { label: 'Share List', href: '/advocacy', icon: Users },
  { label: 'Pitch List', href: '/pitchlist', icon: Newspaper },
  { label: 'Newsroom', href: '/newsroom', icon: Settings },
  { label: 'SEO/AIO', href: '/seo', icon: Code },
  { label: 'Assets', href: '/assets', icon: ImageIcon },
]

export function CompanyNav({ companyUuid, companyName }: CompanyNavProps) {
  const pathname = usePathname()
  const basePath = `/company/${companyUuid}`

  const activeIndex = NAV_ITEMS.findIndex((item) => {
    const fullHref = `${basePath}${item.href}`
    return item.href === ''
      ? pathname === basePath
      : pathname === fullHref || pathname.startsWith(fullHref + '/')
  })

  return (
    <nav aria-label="Brand navigation" className="mb-14">
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/company"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Brands
        </Link>
      </div>
      <ol className="flex items-center">
        {NAV_ITEMS.map((item, idx) => {
          const fullHref = `${basePath}${item.href}`
          const isCurrent = idx === activeIndex
          const isVisited = activeIndex >= 0 && idx < activeIndex
          const Icon = item.icon

          // Detect transition line: this step is visited and the next is current
          const isTransitionLine = isVisited && idx + 1 === activeIndex

          return (
            <li
              key={item.label}
              className={cn('relative', idx !== NAV_ITEMS.length - 1 && 'flex-1')}
            >
              <div className="flex items-center">
                <Link
                  href={fullHref}
                  className={cn(
                    'relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors',
                    isCurrent && 'bg-cyan-700 text-white wizard-step-current',
                    isVisited && 'bg-emerald-600 text-white hover:bg-emerald-700',
                    !isCurrent && !isVisited && 'border-2 border-gray-300 bg-white text-gray-500 hover:border-gray-400'
                  )}
                  title={item.label}
                >
                  <Icon className="h-5 w-5" />
                </Link>

                {idx !== NAV_ITEMS.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 w-full',
                      isTransitionLine && 'wizard-gradient-line',
                      !isTransitionLine && isVisited && 'bg-emerald-600',
                      !isTransitionLine && !isVisited && 'bg-gray-200'
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>

              <span
                className={cn(
                  'absolute -bottom-6 left-5 -translate-x-1/2 whitespace-nowrap text-xs font-medium',
                  isCurrent && 'text-cyan-700',
                  isVisited && 'text-emerald-600',
                  !isCurrent && !isVisited && 'text-gray-500'
                )}
              >
                {item.label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
