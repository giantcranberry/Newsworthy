'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Bell, CreditCard, Globe, Menu, Plus, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useState, useEffect, useCallback } from 'react'

interface HeaderProps {
  onMenuClick?: () => void
  canCreateContent?: boolean
}

interface PreviewMessage {
  id: number
  type: 'global' | 'user'
  subject: string
  senderName: string
  createdAt: string
}

export function Header({ onMenuClick, canCreateContent = true }: HeaderProps) {
  const { data: session } = useSession()
  const [unreadCount, setUnreadCount] = useState(0)
  const [previewMessages, setPreviewMessages] = useState<PreviewMessage[]>([])
  const [popoverOpen, setPopoverOpen] = useState(false)

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/unread-count')
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.count)
      }
    } catch {
      // Silently fail
    }
  }, [])

  // Poll unread count every 60 seconds + listen for inbox read events
  useEffect(() => {
    if (!session?.user) return

    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60000)

    const handleMessageRead = () => fetchUnreadCount()
    window.addEventListener('messages:read', handleMessageRead)

    return () => {
      clearInterval(interval)
      window.removeEventListener('messages:read', handleMessageRead)
    }
  }, [session, fetchUnreadCount])

  // Fetch preview messages when popover opens
  const handlePopoverOpen = async (open: boolean) => {
    setPopoverOpen(open)
    if (open) {
      try {
        const res = await fetch('/api/messages?type=unread')
        if (res.ok) {
          const data = await res.json()
          setPreviewMessages(data.slice(0, 5))
        }
      } catch {
        // Silently fail
      }
    }
  }

  const badgeText = unreadCount > 99 ? '99+' : unreadCount.toString()

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden text-gray-700"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-2">
        {canCreateContent && (
          <>
            {/* Quick create */}
            <Link href="/pr/create">
              <Button size="sm" className="gap-2 bg-cyan-800 text-white hover:bg-cyan-900 cursor-pointer">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Release</span>
              </Button>
            </Link>

            {/* Credits */}
            <Link href="/payment/paygo">
              <Button variant="outline" size="sm" className="gap-2 text-gray-700">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Buy Credits</span>
              </Button>
            </Link>
          </>
        )}

        {/* Notifications */}
        <Popover open={popoverOpen} onOpenChange={handlePopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative inline-flex items-center justify-center size-9 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer outline-none"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
                  {badgeText}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 bg-white border-gray-200">
            <div className="p-3 border-b border-gray-100">
              <h3 className="font-semibold text-sm text-gray-900">Notifications</h3>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {previewMessages.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  No unread messages
                </div>
              ) : (
                previewMessages.map((msg) => (
                  <Link
                    key={`${msg.type}-${msg.id}`}
                    href="/inbox"
                    onClick={() => setPopoverOpen(false)}
                    className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {msg.type === 'global' ? (
                        <Globe className="h-4 w-4 text-cyan-600" />
                      ) : (
                        <User className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{msg.subject}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {msg.senderName} &middot; {new Date(msg.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-2 w-2 rounded-full bg-cyan-600" />
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div className="p-2 border-t border-gray-100">
              <Link
                href="/inbox"
                onClick={() => setPopoverOpen(false)}
                className="block w-full text-center text-sm font-medium text-cyan-800 hover:text-cyan-900 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
              >
                View All Messages
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  )
}
