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

  return (
    <nav aria-label="Brand navigation" className="mb-8">
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
          const isActive = item.href === ''
            ? pathname === basePath
            : pathname === fullHref
          const Icon = item.icon

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
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'border-2 border-gray-300 bg-white text-gray-500 hover:border-blue-400 hover:text-blue-500'
                  )}
                  title={item.label}
                >
                  <Icon className="h-5 w-5" />
                </Link>

                {idx !== NAV_ITEMS.length - 1 && (
                  <div
                    className="ml-4 h-0.5 w-full bg-gray-200"
                    aria-hidden="true"
                  />
                )}
              </div>

              <span
                className={cn(
                  'absolute -bottom-6 left-0 whitespace-nowrap text-xs font-medium',
                  isActive ? 'text-blue-600' : 'text-gray-500'
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
