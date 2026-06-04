'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, CreditCard, Gift, Globe, Menu, MessageCircle, Plus, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useState, useEffect, useCallback, useId } from 'react'

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
  const pathname = usePathname()
  const inPodcastFlow = pathname.startsWith('/pr/podcast')
  const isAdminSpace = pathname.startsWith('/admin') || pathname.startsWith('/editorial')
  const [unreadCount, setUnreadCount] = useState(0)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)
  const [previewMessages, setPreviewMessages] = useState<PreviewMessage[]>([])
  const [popoverOpen, setPopoverOpen] = useState(false)
  const notificationsId = useId()

  // Courtesy code state
  const [hasRedeemedCourtesy, setHasRedeemedCourtesy] = useState(true) // hidden until check
  const [courtesyDialogOpen, setCourtesyDialogOpen] = useState(false)
  const [courtesyCode, setCourtesyCode] = useState('')
  const [courtesyError, setCourtesyError] = useState('')
  const [courtesyLoading, setCourtesyLoading] = useState(false)
  const [courtesySuccess, setCourtesySuccess] = useState(false)
  const [courtesyCredits, setCourtesyCredits] = useState(1)

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

  const fetchChatUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/unread-count')
      if (res.ok) {
        const data = await res.json()
        setChatUnreadCount(data.count)
      }
    } catch {
      // Silently fail
    }
  }, [])

  // Poll unread count every 60 seconds + listen for inbox read events
  useEffect(() => {
    if (!session?.user) return

    fetchUnreadCount()
    fetchChatUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60000)
    const chatInterval = setInterval(fetchChatUnreadCount, 60000)

    const handleMessageRead = () => fetchUnreadCount()
    window.addEventListener('messages:read', handleMessageRead)

    return () => {
      clearInterval(interval)
      clearInterval(chatInterval)
      window.removeEventListener('messages:read', handleMessageRead)
    }
  }, [session, fetchUnreadCount, fetchChatUnreadCount])

  // Check courtesy code redemption status
  useEffect(() => {
    if (!session?.user) return
    fetch('/api/credits/redeem-courtesy')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) setHasRedeemedCourtesy(data.hasRedeemed)
      })
      .catch(() => {})
  }, [session])

  const handleRedeemCourtesy = async () => {
    setCourtesyError('')
    setCourtesyLoading(true)
    try {
      const res = await fetch('/api/credits/redeem-courtesy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: courtesyCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCourtesyError(data.error || 'Failed to redeem code')
        return
      }
      setCourtesySuccess(true)
      setCourtesyCredits(data.credits || 1)
      setHasRedeemedCourtesy(true)
    } catch {
      setCourtesyError('Failed to redeem code')
    } finally {
      setCourtesyLoading(false)
    }
  }

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
    <header className={cn(
      'sticky top-0 z-40 flex h-16 items-center gap-4 border-b px-6',
      isAdminSpace
        ? 'border-purple-300 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/40'
        : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950'
    )}>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden text-gray-700 dark:text-gray-300"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Admin space indicator */}
      {isAdminSpace && (
        <div className="flex items-center gap-2 rounded-md bg-purple-900 px-3 py-1.5 text-white antialiased dark:bg-purple-600">
          <i className="fa-light fa-shield text-sm" aria-hidden="true" />
          <span className="text-sm font-semibold uppercase tracking-wide">Admin</span>
        </div>
      )}

      {/* Actions */}
      <div className="ml-auto flex items-center gap-2">
        {canCreateContent && (
          <div data-tour="header-actions" className="flex items-center gap-2">
            {/* Quick create */}
            <Link href="/pr/create">
              <Button size="sm" className="gap-2 bg-cyan-800 text-white dark:text-white hover:bg-cyan-900 dark:bg-cyan-600 dark:hover:bg-cyan-700 cursor-pointer">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Release</span>
              </Button>
            </Link>

            {/* Credits */}
            {!inPodcastFlow && (
              <Link href="/payment/paygo">
                <Button variant="outline" size="sm" className="gap-2 text-gray-700 dark:text-gray-300">
                  <CreditCard className="h-4 w-4" />
                  <span className="hidden sm:inline">Buy Credits</span>
                </Button>
              </Link>
            )}

            {/* Redeem Code */}
            {!hasRedeemedCourtesy && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-gray-700 dark:text-gray-300"
                onClick={() => {
                  setCourtesyDialogOpen(true)
                  setCourtesyCode('')
                  setCourtesyError('')
                  setCourtesySuccess(false)
                }}
              >
                <Gift className="h-4 w-4 text-red-500" />
                <span className="hidden sm:inline">Redeem Courtesy Code</span>
              </Button>
            )}
          </div>
        )}

        {/* Chat */}
        <Link
          href="/community/chat"
          className="relative inline-flex items-center justify-center size-9 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100 cursor-pointer"
        >
          <MessageCircle className="h-5 w-5" />
          {chatUnreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-600 px-1 text-[10px] text-white">
              {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
            </span>
          )}
        </Link>

        {/* Notifications */}
        <Popover open={popoverOpen} onOpenChange={handlePopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-tour="header-notifications"
              className="relative inline-flex items-center justify-center size-9 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100 cursor-pointer outline-none"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
                  {badgeText}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent id={notificationsId} align="end" className="w-80 p-0 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <div className="p-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Notifications</h3>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {previewMessages.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No unread messages
                </div>
              ) : (
                previewMessages.map((msg) => (
                  <Link
                    key={`${msg.type}-${msg.id}`}
                    href="/inbox"
                    onClick={() => setPopoverOpen(false)}
                    className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0"
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {msg.type === 'global' ? (
                        <Globe className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                      ) : (
                        <User className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{msg.subject}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {msg.senderName} &middot; {new Date(msg.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-2 w-2 rounded-full bg-cyan-600 dark:bg-cyan-400" />
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div className="p-2 border-t border-gray-100 dark:border-gray-800">
              <Link
                href="/inbox"
                onClick={() => setPopoverOpen(false)}
                className="block w-full text-center text-sm font-medium text-cyan-800 hover:text-cyan-900 dark:text-cyan-400 dark:hover:text-cyan-300 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                View All Messages
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Courtesy Code Dialog */}
      <Dialog open={courtesyDialogOpen} onOpenChange={setCourtesyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redeem Courtesy Code</DialogTitle>
            <DialogDescription>
              Enter your courtesy code to receive 1 free press release credit.
            </DialogDescription>
          </DialogHeader>
          {courtesySuccess ? (
            <div className="py-4 text-center">
              <p className="text-green-600 font-medium">Code redeemed successfully!</p>
              <p className="text-sm text-gray-500 mt-1">{courtesyCredits} PR credit{courtesyCredits !== 1 ? 's' : ''} added to your account.</p>
              <Button
                className="mt-4"
                onClick={() => setCourtesyDialogOpen(false)}
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Input
                placeholder="Enter code"
                value={courtesyCode}
                onChange={(e) => {
                  setCourtesyCode(e.target.value)
                  setCourtesyError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && courtesyCode.trim()) handleRedeemCourtesy()
                }}
                disabled={courtesyLoading}
              />
              {courtesyError && (
                <p className="text-sm text-red-600">{courtesyError}</p>
              )}
              <Button
                onClick={handleRedeemCourtesy}
                disabled={courtesyLoading || !courtesyCode.trim()}
              >
                {courtesyLoading ? 'Redeeming...' : 'Redeem'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </header>
  )
}
