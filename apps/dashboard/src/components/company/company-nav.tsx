'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Newspaper,
  Building2,
  Settings,
  Image,
  Images,
  ArrowLeft,
  Code,
  Contact,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CompanyNavProps {
  companyUuid: string
  companyName: string
  disabled?: boolean
}

const NAV_ITEMS = [
  { label: 'Edit Brand', href: '', icon: Building2 },
  { label: 'Logo', href: '/logo', icon: Image },
  { label: 'PR Contacts', href: '/contacts', icon: Contact },
  { label: 'Lists', href: '/pitchlist', icon: Newspaper },
  { label: 'Newsroom', href: '/newsroom', icon: Settings },
  { label: 'SEO/AIO', href: '/seo', icon: Code },
  { label: 'Brand Assets', href: '/assets', icon: Images },
]

export function CompanyNav({ companyUuid, companyName, disabled }: CompanyNavProps) {
  const pathname = usePathname()
  const basePath = disabled ? '/company/add' : `/company/${companyUuid}`

  const activeIndex = NAV_ITEMS.findIndex((item) => {
    const fullHref = `${basePath}${item.href}`
    return item.href === ''
      ? pathname === basePath
      : pathname === fullHref || pathname.startsWith(fullHref + '/')
  })

  return (
    <nav aria-label="Brand navigation" className="mb-14">
      {!disabled && (
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/company"
            className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All Brands
          </Link>
        </div>
      )}
      <ol className="flex items-center">
        {NAV_ITEMS.map((item, idx) => {
          const fullHref = `${basePath}${item.href}`
          const isCurrent = idx === activeIndex
          const isVisited = activeIndex >= 0 && idx < activeIndex
          const Icon = item.icon
          const isFirst = idx === 0

          // Detect transition line: this step is visited and the next is current
          const isTransitionLine = isVisited && idx + 1 === activeIndex

          // In disabled mode, only first tab is active
          const isDisabledTab = disabled && !isFirst

          return (
            <li
              key={item.label}
              className={cn('relative', idx !== NAV_ITEMS.length - 1 && 'flex-1')}
            >
              <div className="flex items-center">
                {isDisabledTab ? (
                  <span
                    className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 text-gray-300 cursor-not-allowed"
                    title={item.label}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                ) : (
                  <Link
                    href={fullHref}
                    className={cn(
                      'relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors',
                      (isCurrent || (disabled && isFirst)) && 'bg-cyan-700 text-white wizard-step-current',
                      !disabled && isVisited && 'bg-emerald-600 text-white hover:bg-emerald-700',
                      !disabled && !isCurrent && !isVisited && 'border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                    )}
                    title={item.label}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                )}

                {idx !== NAV_ITEMS.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 w-full',
                      disabled && 'bg-gray-200 dark:bg-gray-700',
                      !disabled && isTransitionLine && 'wizard-gradient-line',
                      !disabled && !isTransitionLine && isVisited && 'bg-emerald-600',
                      !disabled && !isTransitionLine && !isVisited && 'bg-gray-200 dark:bg-gray-700'
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>

              <span
                className={cn(
                  'absolute -bottom-6 left-5 -translate-x-1/2 whitespace-nowrap text-xs font-medium',
                  isDisabledTab && 'text-gray-300',
                  !isDisabledTab && (isCurrent || (disabled && isFirst)) && 'text-cyan-700',
                  !isDisabledTab && !disabled && isVisited && 'text-emerald-600',
                  !isDisabledTab && !disabled && !isCurrent && !isVisited && 'text-gray-500 dark:text-gray-400'
                )}
              >
                {isFirst && disabled ? 'Add Brand' : item.label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
