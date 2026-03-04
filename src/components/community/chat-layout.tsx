'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ConversationList } from './conversation-list'
import { MessageArea } from './message-area'

interface ChatLayoutProps {
  currentUserId: number
  initialConversationUuid?: string
}

export function ChatLayout({ currentUserId, initialConversationUuid }: ChatLayoutProps) {
  const [activeUuid, setActiveUuid] = useState<string | null>(initialConversationUuid || null)
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

  const handleSelectConversation = (uuid: string) => {
    setActiveUuid(uuid)
    // Mark as read
    fetch(`/api/chat/conversations/${uuid}/read`, { method: 'PATCH' })
  }

  const handleNewConversation = (uuid: string) => {
    setActiveUuid(uuid)
    fetchConversations()
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Conversation list sidebar */}
      <div className={cn(
        'w-80 flex-shrink-0 border-r border-gray-200 flex flex-col',
        activeUuid ? 'hidden md:flex' : 'flex'
      )}>
        <ConversationList
          conversations={conversations}
          activeUuid={activeUuid}
          loading={loading}
          onSelect={handleSelectConversation}
        />
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
