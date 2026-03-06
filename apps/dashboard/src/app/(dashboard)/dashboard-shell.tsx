'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { ImpersonationBanner } from '@/components/layout/impersonation-banner'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { cn } from '@/lib/utils'
import { TourProvider } from '@/components/tour/tour-provider'
import { TourFab } from '@/components/tour/tour-button'

const COLLAPSE_KEY = 'sidebar-collapsed'
const COLLAPSE_HINT_KEY = 'sidebar-collapse-hint-seen'
const AUTO_COLLAPSE_ROUTES = ['/pr/create', '/pr/']

export function DashboardShell({ children, canCreateContent = true }: { children: React.ReactNode; canCreateContent?: boolean }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [manualOverride, setManualOverride] = useState(false)
  const [showHint, setShowHint] = useState(false)

  const shouldAutoCollapse = AUTO_COLLAPSE_ROUTES.some((r) => pathname.startsWith(r))
  const effectiveCollapsed = shouldAutoCollapse
    ? (manualOverride ? collapsed : true)
    : collapsed

  // Restore collapsed preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSE_KEY)
    if (stored === 'true') setCollapsed(true)
  }, [])

  // Reset manual override when leaving/entering auto-collapse routes
  useEffect(() => {
    setManualOverride(false)
  }, [shouldAutoCollapse])

  // Show expand hint once when auto-collapsed
  useEffect(() => {
    if (shouldAutoCollapse && !manualOverride && !localStorage.getItem(COLLAPSE_HINT_KEY)) {
      const showTimer = setTimeout(() => setShowHint(true), 500)
      const hideTimer = setTimeout(() => {
        setShowHint(false)
        localStorage.setItem(COLLAPSE_HINT_KEY, 'true')
      }, 6000)
      return () => { clearTimeout(showTimer); clearTimeout(hideTimer) }
    } else {
      setShowHint(false)
    }
  }, [shouldAutoCollapse, manualOverride])

  const dismissHint = () => {
    setShowHint(false)
    localStorage.setItem(COLLAPSE_HINT_KEY, 'true')
  }

  const toggleCollapse = () => {
    if (shouldAutoCollapse) {
      setManualOverride(true)
    }
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(COLLAPSE_KEY, String(next))
      return next
    })
  }

  return (
    <TourProvider>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
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
          'hidden lg:block flex-shrink-0 transition-all duration-200 relative',
          (effectiveCollapsed) ? 'w-16' : 'w-64'
        )}>
          <div className="sticky top-0 h-screen">
            <Sidebar
              canCreateContent={canCreateContent}
              collapsed={effectiveCollapsed}
              onToggleCollapse={toggleCollapse}
            />
          </div>

          {/* One-time hint pointing to expand button */}
          {showHint && (
            <div
              className="fixed left-18 top-16 z-50 animate-in fade-in slide-in-from-left-2 duration-300"
              onClick={dismissHint}
            >
              <div className="relative rounded-lg border border-cyan-200 dark:border-cyan-800 bg-white dark:bg-gray-900 shadow-lg px-3 py-2 max-w-48 cursor-pointer">
                <div className="absolute -left-1.5 top-3 h-3 w-3 rotate-45 border-l border-b border-cyan-200 dark:border-cyan-800 bg-white dark:bg-gray-900" />
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  Click the <i className="fa-light fa-chevrons-right text-cyan-700 dark:text-cyan-400" /> button to expand your menu
                </p>
              </div>
            </div>
          )}
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
