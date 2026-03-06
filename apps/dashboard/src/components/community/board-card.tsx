'use client'

import Link from 'next/link'

interface Board {
  id: number
  name: string
  slug: string
  description: string | null
  iconClass: string | null
  color: string
}

interface BoardCardProps {
  board: Board
}

export function BoardCard({ board }: BoardCardProps) {
  return (
    <Link
      href={`/community/boards/${board.slug}`}
      className="block rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-gray-300 dark:border-gray-700 hover:shadow-sm dark:shadow-gray-900/50 transition-all"
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: board.color + '20' }}
        >
          <i
            className={board.iconClass || 'fa-light fa-message'}
            style={{ color: board.color }}
          />
        </div>
        <div className="min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">{board.name}</h3>
          {board.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{board.description}</p>
          )}
        </div>
      </div>
    </Link>
  )
}
