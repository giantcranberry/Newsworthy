'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Send } from 'lucide-react'
import { UserAvatar } from './user-avatar'
import { Skeleton } from '@/components/ui/skeleton'

interface Message {
  id: number
  uuid: string
  userId: number
  userName: string
  userAvatar?: string | null
  body: string
  isDeleted: boolean
  createdAt: string
}

interface MessageAreaProps {
  conversationUuid: string
  currentUserId: number
  onBack: () => void
  onMessageSent?: () => void
}

export function MessageArea({
  conversationUuid,
  currentUserId,
  onBack,
  onMessageSent,
}: MessageAreaProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/conversations/${conversationUuid}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [conversationUuid])

  useEffect(() => {
    setLoading(true)
    setMessages([])
    fetchMessages()

    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || sending) return

    setSending(true)
    try {
      const res = await fetch(`/api/chat/conversations/${conversationUuid}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: inputValue.trim() }),
      })

      if (res.ok) {
        setInputValue('')
        await fetchMessages()
        onMessageSent?.()
      }
    } catch {
      // Silent fail
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <button
          onClick={onBack}
          className="md:hidden text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100 cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {messages.length > 0 && (
          <div className="flex items-center gap-2">
            {(() => {
              const otherMsg = messages.find((m) => m.userId !== currentUserId)
              if (!otherMsg) return null
              return (
                <>
                  <UserAvatar name={otherMsg.userName} avatar={otherMsg.userAvatar} size="sm" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{otherMsg.userName}</span>
                </>
              )
            })()}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : ''}`}>
                <Skeleton className="h-10 w-48 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isOwn = msg.userId === currentUserId
            const showAvatar =
              !isOwn && (idx === 0 || messages[idx - 1].userId !== msg.userId)

            return (
              <div
                key={msg.id}
                className={cn('flex items-end gap-2', isOwn ? 'justify-end' : '')}
              >
                {!isOwn && showAvatar && (
                  <UserAvatar name={msg.userName} avatar={msg.userAvatar} size="sm" />
                )}
                {!isOwn && !showAvatar && <div className="w-8" />}
                <div
                  className={cn(
                    'max-w-[70%] rounded-2xl px-4 py-2 text-sm',
                    isOwn
                      ? 'bg-cyan-800 dark:bg-cyan-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  )}
                >
                  {msg.isDeleted ? (
                    <span className="italic text-gray-400">[deleted]</span>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  )}
                  <p className={cn('text-[10px] mt-1', isOwn ? 'text-cyan-200' : 'text-gray-400')}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-full border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-700 focus:border-cyan-700"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputValue.trim() || sending}
            className="h-9 w-9 rounded-full bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </>
  )
}
