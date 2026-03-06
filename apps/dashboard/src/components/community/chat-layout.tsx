'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { MessageSquare } from 'lucide-react'
import { ConversationList } from './conversation-list'
import { MessageArea } from './message-area'
import { UserAvatar } from './user-avatar'
import { Skeleton } from '@/components/ui/skeleton'

interface Follower {
  id: number
  name: string
  avatar?: string | null
  emailHash?: string | null
  acctHandle?: string | null
  location?: string | null
}

interface ChatLayoutProps {
  currentUserId: number
  initialConversationUuid?: string
}

export function ChatLayout({ currentUserId, initialConversationUuid }: ChatLayoutProps) {
  const [activeUuid, setActiveUuid] = useState<string | null>(initialConversationUuid || null)
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [followers, setFollowers] = useState<Follower[]>([])
  const [followersLoading, setFollowersLoading] = useState(true)
  const [startingChat, setStartingChat] = useState<number | null>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/conversations')
      if (res.ok) {
        setConversations(await res.json())
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
    const interval = setInterval(fetchConversations, 30000)
    return () => clearInterval(interval)
  }, [fetchConversations])

  useEffect(() => {
    fetch('/api/community/follows/followers')
      .then((res) => res.json())
      .then((data) => setFollowers(data))
      .catch(() => {})
      .finally(() => setFollowersLoading(false))
  }, [])

  const handleSelectConversation = (uuid: string) => {
    setActiveUuid(uuid)
    fetch(`/api/chat/conversations/${uuid}/read`, { method: 'PATCH' })
  }

  const handleNewConversation = (uuid: string) => {
    setActiveUuid(uuid)
    fetchConversations()
  }

  const handleStartChat = async (userId: number) => {
    setStartingChat(userId)
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        const data = await res.json()
        handleNewConversation(data.uuid)
      }
    } finally {
      setStartingChat(null)
    }
  }

  // Filter out followers who already have a conversation
  const existingUserIds = new Set(
    conversations.map((c: any) => c.otherUser?.userId).filter(Boolean)
  )
  const filteredFollowers = followers.filter((f) => !existingUserIds.has(f.id))

  return (
    <div className="flex h-[calc(100vh-12rem)] rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Conversation list sidebar */}
      <div className={cn(
        'w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col',
        activeUuid ? 'hidden md:flex' : 'flex'
      )}>
        <ConversationList
          conversations={conversations}
          activeUuid={activeUuid}
          loading={loading}
          onSelect={handleSelectConversation}
        />

        {/* Followers section */}
        {!loading && filteredFollowers.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-800">
            <div className="px-4 py-2">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                People following you
              </h3>
            </div>
            <div className="overflow-y-auto max-h-60">
              {filteredFollowers.map((follower) => (
                <div
                  key={follower.id}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <UserAvatar
                    name={follower.name}
                    avatar={follower.avatar}
                    emailHash={follower.emailHash}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{follower.name}</p>
                    {follower.acctHandle && (
                      <p className="text-xs text-gray-400 truncate">@{follower.acctHandle}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleStartChat(follower.id)}
                    disabled={startingChat === follower.id}
                    className="flex-shrink-0 rounded-md p-1.5 text-gray-400 hover:text-cyan-700 dark:hover:text-cyan-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={`Message ${follower.name}`}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {followersLoading && !loading && (
          <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message area */}
      <div className={cn(
        'flex-1 flex flex-col',
        !activeUuid ? 'hidden md:flex' : 'flex'
      )}>
        {activeUuid ? (
          <MessageArea
            conversationUuid={activeUuid}
            currentUserId={currentUserId}
            onBack={() => setActiveUuid(null)}
            onMessageSent={fetchConversations}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <i className="fa-light fa-messages text-4xl mb-2" />
              <p className="text-sm">Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
