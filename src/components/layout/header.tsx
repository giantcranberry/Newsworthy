'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Bell, CreditCard, Menu, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  onMenuClick?: () => void
  canCreateContent?: boolean
}

export function Header({ onMenuClick, canCreateContent = true }: HeaderProps) {
  const { data: session } = useSession()

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
        {canCreateContent && (
          <Button variant="ghost" size="icon" className="relative text-gray-700">
            <Bell className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              3
            </span>
          </Button>
        )}
      </div>
    </header>
  )
}
