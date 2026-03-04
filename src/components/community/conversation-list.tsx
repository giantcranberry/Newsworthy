'use client'

import { cn } from '@/lib/utils'
import { UserAvatar } from './user-avatar'
import { Skeleton } from '@/components/ui/skeleton'

interface Conversation {
  uuid: string
  otherUser: {
    userId: number
    name: string
    avatar?: string | null
    acctHandle?: string | null
  }
  lastMessage?: {
    body: string
    isOwn: boolean
    createdAt: string
  } | null
  unreadCount: number
}

interface ConversationListProps {
  conversations: Conversation[]
  activeUuid: string | null
  loading: boolean
  onSelect: (uuid: string) => void
}

export function ConversationList({
  conversations,
  activeUuid,
  loading,
  onSelect,
}: ConversationListProps) {
  if (loading) {
    return (
      <div className="p-3 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-gray-400 text-center">No conversations yet</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv) => {
        const isActive = conv.uuid === activeUuid
        const preview = conv.lastMessage
          ? (conv.lastMessage.isOwn ? 'You: ' : '') +
            (conv.lastMessage.body.length > 40
              ? conv.lastMessage.body.slice(0, 40) + '...'
              : conv.lastMessage.body)
          : 'No messages yet'

        return (
          <button
            key={conv.uuid}
            onClick={() => onSelect(conv.uuid)}
            className={cn(
              'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer',
              isActive ? 'bg-cyan-50 dark:bg-cyan-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950'
            )}
          >
            <UserAvatar
              name={conv.otherUser.name}
              avatar={conv.otherUser.avatar}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className={cn('text-sm truncate', conv.unreadCount > 0 ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-900 dark:text-gray-100')}>
                  {conv.otherUser.name}
                </span>
                {conv.lastMessage && (
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                    {formatTime(new Date(conv.lastMessage.createdAt))}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className={cn('text-xs truncate', conv.unreadCount > 0 ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400')}>
                  {preview}
                </p>
                {conv.unreadCount > 0 && (
                  <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-600 px-1.5 text-[10px] font-bold text-white flex-shrink-0">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
