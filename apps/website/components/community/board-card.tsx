import Link from 'next/link'

interface BoardCardProps {
  board: {
    name: string
    slug: string
    description: string | null
    iconClass: string | null
    color: string
    postCount: number
  }
}

export function BoardCard({ board }: BoardCardProps) {
  return (
    <Link
      href={`/community/board/${board.slug}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all"
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
          <h3 className="font-medium text-gray-900">{board.name}</h3>
          {board.description && (
            <p className="text-sm text-gray-500 truncate">{board.description}</p>
          )}
        </div>
        <span className="ml-auto text-xs text-gray-400 flex-shrink-0">
          {board.postCount} {board.postCount === 1 ? 'post' : 'posts'}
        </span>
      </div>
    </Link>
  )
}
