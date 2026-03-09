'use client'

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { MessageCircle, Loader2, Mail, MailCheck } from 'lucide-react'

interface HistoryMessage {
  id: number
  subject: string
  body: string
  emailSent: boolean
  isRead: boolean
  createdAt: string
  senderEmail: string | null
  senderFirstName: string | null
  senderLastName: string | null
}

export interface MessageHistoryRef {
  refresh: () => void
}

export const MessageHistory = forwardRef<MessageHistoryRef, { releaseId: number }>(
  function MessageHistory({ releaseId }, ref) {
    const [messages, setMessages] = useState<HistoryMessage[]>([])
    const [loading, setLoading] = useState(true)

    const fetchMessages = useCallback(async () => {
      try {
        const res = await fetch(`/api/admin/messages/by-release/${releaseId}`)
        if (res.ok) {
          const data = await res.json()
          setMessages(data)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }, [releaseId])

    useEffect(() => {
      fetchMessages()
    }, [fetchMessages])

    useImperativeHandle(ref, () => ({
      refresh: () => {
        setLoading(true)
        fetchMessages()
      },
    }))

    const senderName = (msg: HistoryMessage) => {
      if (msg.senderFirstName || msg.senderLastName) {
        return [msg.senderFirstName, msg.senderLastName].filter(Boolean).join(' ')
      }
      return msg.senderEmail || 'System'
    }

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr)
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    }

    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 h-full">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Message History</p>
          <span className="text-xs text-gray-400">({messages.length})</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <Mail className="h-8 w-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-400 dark:text-gray-500">No messages sent for this release</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {messages.map(msg => (
              <div key={msg.id} className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
                    {msg.subject}
                  </p>
                  {msg.emailSent ? (
                    <span title="Email delivered"><MailCheck className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" /></span>
                  ) : (
                    <span title="Email not sent"><Mail className="h-3 w-3 text-gray-300 flex-shrink-0 mt-0.5" /></span>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap line-clamp-3">
                  {msg.body}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                  <span>{senderName(msg)}</span>
                  <span>&middot;</span>
                  <span>{formatDate(msg.createdAt)}</span>
                  {msg.isRead && (
                    <>
                      <span>&middot;</span>
                      <span className="text-green-500">Read</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
)
