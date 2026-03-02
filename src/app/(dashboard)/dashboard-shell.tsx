'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { ImpersonationBanner } from '@/components/layout/impersonation-banner'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { cn } from '@/lib/utils'
import { TourProvider } from '@/components/tour/tour-provider'
import { TourFab } from '@/components/tour/tour-button'

const COLLAPSE_KEY = 'sidebar-collapsed'

export function DashboardShell({ children, canCreateContent = true }: { children: React.ReactNode; canCreateContent?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Restore collapsed preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSE_KEY)
    if (stored === 'true') setCollapsed(true)
  }, [])

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(COLLAPSE_KEY, String(next))
      return next
    })
  }

  return (
    <TourProvider>
      <div className="flex h-screen bg-gray-50">
        {/* Mobile sidebar via Sheet */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
            <VisuallyHidden>
              <SheetTitle>Navigation</SheetTitle>
            </VisuallyHidden>
            <Sidebar canCreateContent={canCreateContent} />
          </SheetContent>
        </Sheet>

        {/* Desktop sidebar */}
        <aside className={cn(
          'hidden lg:block flex-shrink-0 transition-all duration-200',
          collapsed ? 'w-16' : 'w-64'
        )}>
          <div className="sticky top-0 h-screen">
            <Sidebar
              canCreateContent={canCreateContent}
              collapsed={collapsed}
              onToggleCollapse={toggleCollapse}
            />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <ImpersonationBanner />
          <Header onMenuClick={() => setMobileOpen(true)} canCreateContent={canCreateContent} />
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6">{children}</div>
          </main>
        </div>
        <TourFab />
      </div>
    </TourProvider>
  )
}
