'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Globe, User, Archive, Trash2, CheckCheck, Circle, Loader2, Inbox, ChevronDown, ChevronUp, Reply, Send, Star, ClipboardList } from 'lucide-react'
import { InboxTaskDialog } from './inbox-task-dialog'

interface InboxMessage {
  id: number
  type: 'global' | 'user'
  subject: string
  body: string
  createdAt: string
  isRead: boolean
  isArchived: boolean
  senderName: string
  fromId: number | null
  taskId: number | null
}

type FilterType = 'all' | 'unread' | 'archived'

function isStarredMessage(subject: string): boolean {
  return subject.startsWith('New Note on Task:') ||
    subject.startsWith('Task Assigned:') ||
    subject.startsWith('Task Moved:')
}

export function InboxList() {
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [replySuccess, setReplySuccess] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [taskDialogId, setTaskDialogId] = useState<number | null>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?type=${filter}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err)
    } finally {
      setIsLoading(false)
    }
  }, [filter])

  useEffect(() => {
    setIsLoading(true)
    setSelectedIds(new Set())
    fetchMessages()
  }, [fetchMessages])

  const handleAction = async (id: number, type: 'global' | 'user', action: 'read' | 'unread' | 'archive' | 'delete') => {
    const key = `${type}-${id}-${action}`
    setActionLoading(key)

    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, type }),
      })

      if (res.ok) {
        fetchMessages()
        window.dispatchEvent(new Event('messages:read'))
      }
    } catch (err) {
      console.error('Failed to update message:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkAction = async (action: 'read' | 'archive' | 'delete') => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)

    const selected = Array.from(selectedIds).map(key => {
      const [type, id] = key.split('-')
      return { type: type as 'global' | 'user', id: parseInt(id) }
    })

    try {
      const res = await fetch('/api/messages/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, messages: selected }),
      })

      if (res.ok) {
        setSelectedIds(new Set())
        fetchMessages()
        window.dispatchEvent(new Event('messages:read'))
      }
    } catch (err) {
      console.error('Failed to perform bulk action:', err)
    } finally {
      setBulkLoading(false)
    }
  }

  const toggleSelect = (key: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === messages.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(messages.map(m => `${m.type}-${m.id}`)))
    }
  }

  const toggleExpand = async (msg: InboxMessage) => {
    const key = `${msg.type}-${msg.id}`
    if (expandedId === key) {
      setExpandedId(null)
      setReplyingTo(null)
      setReplyText('')
    } else {
      setExpandedId(key)
      setReplyingTo(null)
      setReplyText('')
      if (!msg.isRead) {
        handleAction(msg.id, msg.type, 'read')
      }
    }
  }

  const handleReply = async (msg: InboxMessage) => {
    if (!replyText.trim()) return

    setReplySending(true)
    try {
      const res = await fetch('/api/messages/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: msg.id,
          body: replyText.trim(),
        }),
      })

      if (res.ok) {
        const key = `${msg.type}-${msg.id}`
        setReplyingTo(null)
        setReplyText('')
        setReplySuccess(key)
        setTimeout(() => setReplySuccess(null), 3000)
      }
    } catch (err) {
      console.error('Failed to send reply:', err)
    } finally {
      setReplySending(false)
    }
  }

  const filters: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Unread', value: 'unread' },
    { label: 'Archived', value: 'archived' },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                filter === f.value
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm dark:shadow-gray-900/50'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {messages.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-1">
          <Checkbox
            checked={selectedIds.size === messages.length && messages.length > 0}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all messages"
          />
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {selectedIds.size} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('read')}
                disabled={bulkLoading}
                className="gap-1 text-xs"
              >
                {bulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                Mark Read
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('archive')}
                disabled={bulkLoading}
                className="gap-1 text-xs"
              >
                {bulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                Archive
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('delete')}
                disabled={bulkLoading}
                className="gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700"
              >
                {bulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Delete
              </Button>
            </div>
          )}
        </div>
      )}

      {messages.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Inbox className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {filter === 'unread' ? 'No unread messages' :
               filter === 'archived' ? 'No archived messages' :
               'Your inbox is empty'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => {
            const key = `${msg.type}-${msg.id}`
            const isExpanded = expandedId === key
            const isReplying = replyingTo === key
            const canReply = msg.type === 'user' && msg.fromId !== null
            const isActionLoading = (action: string) => actionLoading === `${msg.type}-${msg.id}-${action}`
            const isSelected = selectedIds.has(key)
            const starred = isStarredMessage(msg.subject)

            return (
              <Card key={key} className={!msg.isRead ? 'border-cyan-200 bg-cyan-50 dark:bg-cyan-900/30/30' : ''}>
                <CardContent className="p-0">
                  {/* Message header - clickable */}
                  <div className="flex items-start">
                    {/* Checkbox */}
                    <div className="flex items-center pl-4 pt-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(key)}
                        aria-label={`Select "${msg.subject}"`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    <button
                      onClick={() => toggleExpand(msg)}
                      className="w-full text-left p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {/* Unread dot */}
                        <div className="mt-1.5 flex-shrink-0">
                          {!msg.isRead ? (
                            <div className="h-2 w-2 rounded-full bg-cyan-600" />
                          ) : (
                            <div className="h-2 w-2" />
                          )}
                        </div>

                        {/* Icon */}
                        <div className="flex-shrink-0 mt-0.5">
                          {msg.type === 'global' ? (
                            <Globe className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                          ) : (
                            <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {starred && (
                              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                            )}
                            <span className={`text-sm ${!msg.isRead ? 'font-semibold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                              {msg.subject}
                            </span>
                            {msg.type === 'global' && (
                              <Badge className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 text-xs">Announcement</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{msg.senderName}</span>
                            <span className="text-xs text-gray-400">&middot;</span>
                            <span className="text-xs text-gray-400">
                              {new Date(msg.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Expand icon */}
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800">
                      {/* Message body — bodies are server-generated by our own system (sendSystemMessageWithEmail), not user-submitted content */}
                      <div
                        className="prose prose-sm max-w-none mt-3 text-gray-700 dark:text-gray-300"
                        dangerouslySetInnerHTML={{ __html: msg.body }}
                      />

                      {/* Task quick-view button */}
                      {msg.taskId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setTaskDialogId(msg.taskId!) }}
                          className="mt-3 gap-1.5 text-xs"
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                          View Task
                        </Button>
                      )}

                      {/* Reply success */}
                      {replySuccess === key && (
                        <div className="mt-3 p-2 text-sm text-green-700 dark:text-green-400 bg-green-50 rounded-md">
                          Reply sent successfully
                        </div>
                      )}

                      {/* Reply form */}
                      {isReplying && (
                        <div className="mt-4 space-y-2">
                          <Textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Reply to ${msg.senderName}...`}
                            rows={3}
                            autoFocus
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setReplyingTo(null); setReplyText('') }}
                              disabled={replySending}
                              className="text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleReply(msg)}
                              disabled={replySending || !replyText.trim()}
                              className="gap-1 text-xs bg-cyan-800 dark:bg-cyan-600 hover:bg-cyan-900 dark:hover:bg-cyan-700 text-white"
                            >
                              {replySending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                              Send Reply
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                        {canReply && !isReplying && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setReplyingTo(key) }}
                            className="gap-1 text-xs"
                          >
                            <Reply className="h-3 w-3" />
                            Reply
                          </Button>
                        )}
                        {!msg.isRead ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleAction(msg.id, msg.type, 'read') }}
                            disabled={isActionLoading('read')}
                            className="gap-1 text-xs"
                          >
                            {isActionLoading('read') ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                            Mark Read
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleAction(msg.id, msg.type, 'unread') }}
                            disabled={isActionLoading('unread')}
                            className="gap-1 text-xs"
                          >
                            {isActionLoading('unread') ? <Loader2 className="h-3 w-3 animate-spin" /> : <Circle className="h-3 w-3" />}
                            Mark Unread
                          </Button>
                        )}
                        {!msg.isArchived && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleAction(msg.id, msg.type, 'archive') }}
                            disabled={isActionLoading('archive')}
                            className="gap-1 text-xs"
                          >
                            {isActionLoading('archive') ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                            Archive
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleAction(msg.id, msg.type, 'delete') }}
                          disabled={isActionLoading('delete')}
                          className="gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:text-red-400"
                        >
                          {isActionLoading('delete') ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Task detail dialog */}
      {taskDialogId && (
        <InboxTaskDialog
          open={!!taskDialogId}
          onOpenChange={(open) => { if (!open) setTaskDialogId(null) }}
          taskId={taskDialogId}
        />
      )}
    </div>
  )
}
