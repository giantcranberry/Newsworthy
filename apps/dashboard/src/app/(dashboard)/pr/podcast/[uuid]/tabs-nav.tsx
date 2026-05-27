import Link from 'next/link'
import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TabsNavProps {
  feedUuid: string
  active: 'episodes' | 'notifications' | 'funding'
  stepsDone: {
    episodes: boolean
    notifications: boolean
    funding: boolean
  }
}

const TABS = [
  { id: 'episodes' as const, label: '1. Episodes', href: '' },
  { id: 'notifications' as const, label: '2. Notifications', href: '?tab=notifications' },
  { id: 'funding' as const, label: '3. Funding', href: '?tab=funding' },
]

export function TabsNav({ feedUuid, active, stepsDone }: TabsNavProps) {
  const base = `/pr/podcast/${feedUuid}`

  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      <nav className="flex gap-1 overflow-x-auto" aria-label="Setup steps">
        {TABS.map((tab, idx) => {
          const isActive = tab.id === active
          const isDone = stepsDone[tab.id]
          return (
            <div key={tab.id} className="flex items-center">
              <Link
                href={`${base}${tab.href}`}
                className={cn(
                  'group flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-cyan-700 text-cyan-800 dark:border-cyan-400 dark:text-cyan-400'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-200',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
                    isDone
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                      : isActive
                        ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                  )}
                  aria-hidden="true"
                >
                  {isDone ? <Check className="h-3 w-3" /> : idx + 1}
                </span>
                <span>{tab.label.replace(/^\d+\.\s*/, '')}</span>
              </Link>
              {idx < TABS.length - 1 && (
                <ChevronRight
                  className="mx-1 h-4 w-4 text-gray-300 dark:text-gray-700"
                  aria-hidden="true"
                />
              )}
            </div>
          )
        })}
      </nav>
    </div>
  )
}
