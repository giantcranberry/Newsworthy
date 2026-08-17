'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { signOut, useSession } from 'next-auth/react'
import { useState, useEffect, useCallback } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTour } from '@/hooks/use-tour'
import { routeTourMap } from '@/components/tour/tour-button'

interface NavChild {
  title: string
  href: string
  icon: string
  iconClassName?: string
  requiresCreate?: boolean
  matchPaths?: string[]
  dividerBefore?: boolean
  dividerAfter?: boolean
}

interface NavGroup {
  title: string
  href: string
  icon: string
  children: NavChild[]
  roles?: string[]
}

interface NavLink {
  title: string
  href: string
  icon: string
  roles?: string[]
}

type SidebarMode = 'user' | 'admin'

interface NavSection {
  label: string
  items: (NavGroup | NavLink)[]
  mode?: SidebarMode
}

function isNavGroup(item: NavGroup | NavLink): item is NavGroup {
  return 'children' in item && item.children !== undefined
}

const SIDEBAR_MODE_KEY = 'sidebar-mode'

const navSections: NavSection[] = [
  {
    label: '',
    items: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: 'fa-light fa-grid-2',
      },
      {
        title: 'Admin Dashboard',
        href: '/admin',
        icon: 'fa-light fa-shield',
        roles: ['admin', 'editor', 'staff'],
      },
    ],
  },
  {
    label: '',
    mode: 'user',
    items: [
      {
        title: 'Press Releases',
        href: '/pr',
        icon: 'fa-light fa-newspaper',
        children: [
          { title: 'All Releases', href: '/pr', icon: 'fa-light fa-file-lines' },
          { title: 'Create New', href: '/pr/create', icon: 'fa-light fa-file-circle-plus', requiresCreate: true },
          { title: 'Drafts', href: '/pr/drafts', icon: 'fa-light fa-file-pen', requiresCreate: true },
          { title: 'Podcast PR', href: '/pr/podcast', icon: 'fa-light fa-podcast', requiresCreate: true },
          { title: 'Get Add-ons', href: '/addons', icon: 'fa-light fa-star', iconClassName: 'text-amber-500', dividerBefore: true, dividerAfter: true },
          { title: 'Reports', href: '/pr/reports', icon: 'fa-light fa-chart-bar', matchPaths: ['/pr/clips'] },
        ],
      },
      {
        title: 'Brands',
        href: '/company',
        icon: 'fa-light fa-flag',
        children: [
          { title: 'All Brands', href: '/company', icon: 'fa-light fa-flag' },
          { title: 'Add Brand', href: '/company/add', icon: 'fa-light fa-flag', requiresCreate: true },
          { title: 'AI A2A Keys', href: '/settings/api-keys', icon: 'fa-light fa-key' },
        ],
      },
      {
        title: 'CRM',
        href: '/crm',
        icon: 'fa-light fa-address-book',
        children: [
          { title: 'All Contacts', href: '/crm', icon: 'fa-light fa-users' },
          { title: 'Import Contacts', href: '/crm/import', icon: 'fa-light fa-file-import' },
        ],
      },
      {
        title: 'Billing',
        href: '/billing',
        icon: 'fa-light fa-coins',
        children: [
          { title: 'Manage Credits', href: '/credits/manage', icon: 'fa-light fa-coins' },
          { title: 'Purchases', href: '/billing/purchases', icon: 'fa-light fa-receipt' },
        ],
      },
      {
        title: 'My Tasks',
        href: '/tasks',
        icon: 'fa-light fa-list-check',
      },
      {
        title: 'Calendar',
        href: '/calendar',
        icon: 'fa-light fa-calendar-days',
      },
      {
        title: 'Community',
        href: '/community',
        icon: 'fa-light fa-comments',
        children: [
          { title: 'Feed', href: '/community', icon: 'fa-light fa-stream' },
          { title: 'Chat', href: '/community/chat', icon: 'fa-light fa-message' },
          { title: 'Guidelines', href: '/community/guidelines', icon: 'fa-light fa-book' },
        ],
      },
      {
        title: 'Partner',
        href: '/partner',
        icon: 'fa-light fa-handshake',
        roles: ['manager'],
        children: [
          { title: 'Dashboard', href: '/partner', icon: 'fa-light fa-chart-pie' },
          { title: 'Users', href: '/partner/users', icon: 'fa-light fa-users' },
          { title: 'Press Releases', href: '/partner/releases', icon: 'fa-light fa-newspaper' },
        ],
      },
    ],
  },
  {
    label: '',
    mode: 'admin',
    items: [
      {
        title: 'Editorial',
        href: '/editorial',
        icon: 'fa-light fa-clipboard-check',
        roles: ['editor', 'admin'],
        children: [
          { title: 'Queue', href: '/editorial/queue', icon: 'fa-light fa-clipboard-list' },
          { title: 'Enhanced Queue', href: '/editorial/queue-enhanced', icon: 'fa-light fa-clipboard-list-check' },
          { title: 'Podcast Drafts', href: '/editorial/podcast-drafts', icon: 'fa-light fa-podcast' },
          { title: 'Approved Pending', href: '/editorial/pending', icon: 'fa-light fa-clock' },
          { title: 'Edit Released', href: '/editorial/released-edit', icon: 'fa-light fa-pen-to-square' },
        ],
      },
      {
        title: 'Users',
        href: '/admin/users',
        icon: 'fa-light fa-users',
        roles: ['admin'],
      },
      {
        title: 'Brands',
        href: '/admin/brands',
        icon: 'fa-light fa-flag',
        roles: ['admin'],
      },
      {
        title: 'Admin',
        href: '/admin',
        icon: 'fa-light fa-gear',
        roles: ['admin'],
        children: [
          { title: 'Analytics', href: '/admin/analytics', icon: 'fa-light fa-chart-line' },
          { title: 'Partners', href: '/admin/partners', icon: 'fa-light fa-handshake' },
          { title: 'Products', href: '/admin/products', icon: 'fa-light fa-credit-card' },
          { title: 'Categories', href: '/admin/categories', icon: 'fa-light fa-tags' },
          { title: 'Email Templates', href: '/admin/email-templates', icon: 'fa-light fa-envelope-open-text' },
          { title: 'Assets', href: '/admin/assets', icon: 'fa-light fa-folder-open' },
          { title: 'Settings', href: '/admin/settings', icon: 'fa-light fa-toggle-on' },
        ],
      },
      {
        title: 'Messages',
        href: '/admin/messages',
        icon: 'fa-light fa-envelope',
        roles: ['admin'],
      },
      {
        title: 'Tasks',
        href: '/admin/tasks',
        icon: 'fa-light fa-list-check',
        roles: ['editor', 'admin'],
      },
      {
        title: 'Community',
        href: '/admin/community',
        icon: 'fa-light fa-comments',
        roles: ['admin'],
        children: [
          { title: 'Boards', href: '/admin/community/boards', icon: 'fa-light fa-table-columns' },
          { title: 'Guidelines', href: '/admin/community/guidelines', icon: 'fa-light fa-book' },
        ],
      },
    ],
  },
]

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/editorial')
}

function getInitialMode(pathname: string): SidebarMode {
  if (isAdminPath(pathname)) return 'admin'
  return 'user'
}

function FaIcon({ icon, className }: { icon: string; className?: string }) {
  return <i className={cn(icon, className)} aria-hidden="true" />
}

export function Sidebar({
  canCreateContent = true,
  collapsed = false,
  onToggleCollapse,
}: {
  canCreateContent?: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { startTour } = useTour()
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [mode, setModeState] = useState<SidebarMode>(() => getInitialMode(pathname))

  const currentTourRoute = routeTourMap[pathname]
  const handleStartTour = () => {
    if (!currentTourRoute) return
    const tourId = currentTourRoute.resolver ? currentTourRoute.resolver() : currentTourRoute.tourId
    startTour(tourId)
  }

  const setMode = useCallback((newMode: SidebarMode) => {
    setModeState(newMode)
    localStorage.setItem(SIDEBAR_MODE_KEY, newMode)
  }, [])

  // Restore saved mode from localStorage after hydration
  useEffect(() => {
    if (!isAdminPath(pathname)) {
      const stored = localStorage.getItem(SIDEBAR_MODE_KEY)
      if (stored === 'user' || stored === 'admin') {
        setModeState(stored)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-detect mode from pathname changes
  useEffect(() => {
    if (isAdminPath(pathname)) {
      setMode('admin')
    }
  }, [pathname, setMode])

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === path
    return pathname === path || pathname.startsWith(path + '/')
  }

  const getActiveChild = (children: NavChild[]): NavChild | null => {
    const exactMatch = children.find((c) => pathname === c.href)
    if (exactMatch) return exactMatch

    const matchPathExact = children.find((c) =>
      c.matchPaths?.some((p) => pathname === p)
    )
    if (matchPathExact) return matchPathExact

    const prefixMatches = children.filter((c) =>
      pathname.startsWith(c.href + '/') ||
      c.matchPaths?.some((p) => pathname.startsWith(p + '/'))
    )
    if (prefixMatches.length === 0) return null

    return prefixMatches.sort((a, b) => {
      const aLen = Math.max(a.href.length, ...(a.matchPaths?.map((p) => p.length) || [0]))
      const bLen = Math.max(b.href.length, ...(b.matchPaths?.map((p) => p.length) || [0]))
      return bLen - aLen
    })[0]
  }

  const isChildActive = (child: NavChild, siblings: NavChild[]) => {
    return getActiveChild(siblings)?.href === child.href
  }

  const hasActiveChild = (item: NavGroup) => {
    return getActiveChild(item.children) !== null
  }

  const isGroupExpanded = (key: string, item: NavGroup): boolean => {
    if (collapsed) return false
    if (expandedGroups[key] !== undefined) return expandedGroups[key]
    return hasActiveChild(item)
  }

  const toggleGroup = (key: string, item: NavGroup) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [key]: !isGroupExpanded(key, item),
    }))
  }

  const getUserRoles = (): string[] => {
    const roles: string[] = []
    if ((session?.user as any)?.isAdmin) roles.push('admin')
    if ((session?.user as any)?.isEditor) roles.push('editor')
    if ((session?.user as any)?.isStaff) roles.push('staff')
    if ((session?.user as any)?.managedPartnerIds?.length > 0) roles.push('manager')
    return roles
  }

  const hasAccess = (roles?: string[]) => {
    if (!roles) return true
    const userRoles = getUserRoles()
    return roles.some((role) => userRoles.includes(role))
  }

  const isRoleRestricted = (roles?: string[]) => {
    return roles && roles.length > 0
  }

  const accentColor = (roles?: string[], sectionMode?: SidebarMode) =>
    isRoleRestricted(roles) && sectionMode === 'admin'
      ? {
          active: 'bg-purple-900/10 text-purple-900 dark:bg-purple-400/10 dark:text-purple-400',
          activeBold: 'bg-purple-900/10 text-purple-900 dark:bg-purple-400/10 dark:text-purple-400 font-semibold',
          header: 'text-purple-900 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20',
          idle: 'text-purple-900 hover:bg-purple-50 hover:text-purple-900 dark:text-purple-400 dark:hover:bg-purple-900/20 dark:hover:text-purple-300',
          childIdle: 'text-purple-900 hover:bg-purple-50 hover:text-purple-900 dark:text-purple-400 dark:hover:bg-purple-900/20 dark:hover:text-purple-300',
        }
      : {
          active: 'bg-cyan-800/10 text-cyan-800 dark:bg-cyan-400/10 dark:text-cyan-400',
          activeBold: 'bg-cyan-800/10 text-cyan-800 dark:bg-cyan-400/10 dark:text-cyan-400 font-semibold',
          header: 'text-cyan-800 bg-gray-50 dark:text-cyan-400 dark:bg-gray-800',
          idle: 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100',
          childIdle: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
        }

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn(
        'flex h-full flex-col border-r border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-950 transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}>
        {/* Logo */}
        <div className={cn(
          'flex h-16 items-center border-b border-slate-200 dark:border-gray-800',
          collapsed ? 'justify-center px-2' : 'px-6'
        )}>
          <Link href="/dashboard">
            {collapsed ? (
              <Image src="https://cdn.newsramp.app/logos/168-1769471247932.png" alt="Newsworthy" width={28} height={28} priority className="rounded-full" />
            ) : (
              <Image src="/logo.svg" alt="Newsworthy" width={225} height={42} priority className="dark:brightness-0 dark:invert" />
            )}
          </Link>
        </div>

        {/* Collapse toggle */}
        {onToggleCollapse && (
          <div className={cn('border-b border-slate-200 dark:border-gray-800', collapsed ? 'p-2' : 'px-4 py-2')}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleCollapse}
                  className={cn(
                    'flex items-center h-8 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 cursor-pointer transition-colors',
                    collapsed ? 'justify-center w-full' : 'px-3 gap-3 w-full'
                  )}
                >
                  <i
                    className={cn(
                      'fa-light text-sm transition-transform duration-200',
                      collapsed ? 'fa-chevrons-right' : 'fa-chevrons-left'
                    )}
                    aria-hidden="true"
                  />
                  {!collapsed && <span className="text-xs font-medium">Collapse</span>}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">Expand sidebar</TooltipContent>
              )}
            </Tooltip>
          </div>
        )}

        {/* Navigation */}
        <nav data-tour="sidebar-nav" className={cn(
          'flex-1 overflow-y-auto space-y-6',
          collapsed ? 'p-2' : 'p-4'
        )}>
          {navSections
            .filter((section) => !section.mode || section.mode === mode)
            .map((section, sectionIdx) => {
            const visibleItems = section.items.filter((item) => hasAccess(item.roles))
            if (visibleItems.length === 0) return null

            // Check if this is the top section (mode switchers)
            const isTopSection = !section.mode

            return (
              <div key={section.label || `section-${sectionIdx}`}>
                {section.label && !collapsed && (
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-3">
                    {section.label}
                  </h3>
                )}
                {section.label && collapsed && (
                  <div className="my-2 border-t border-slate-200 dark:border-gray-800" />
                )}
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    // Mode switcher items (Dashboard / Admin Dashboard)
                    if (isTopSection && !isNavGroup(item)) {
                      const targetMode: SidebarMode = item.href === '/admin' ? 'admin' : 'user'
                      const isActiveMode = mode === targetMode
                      const active = isActive(item.href)
                      const colors = accentColor(item.roles, section.mode)
                      // The Admin Dashboard switcher uses the purple admin accent
                      // for its active state, matching the admin-mode sidebar.
                      const isAdminSwitcher = item.href === '/admin'
                      const activeClass = isAdminSwitcher
                        ? 'bg-purple-900/10 text-purple-900 dark:bg-purple-400/10 dark:text-purple-400'
                        : colors.active
                      const activeBoldClass = isAdminSwitcher
                        ? 'bg-purple-900/10 text-purple-900 dark:bg-purple-400/10 dark:text-purple-400 font-semibold'
                        : colors.activeBold

                      const handleClick = () => {
                        setMode(targetMode)
                      }

                      if (collapsed) {
                        return (
                          <Tooltip key={item.href}>
                            <TooltipTrigger asChild>
                              <Link
                                href={item.href}
                                onClick={handleClick}
                                className={cn(
                                  'flex items-center justify-center h-10 w-full rounded-md transition-colors cursor-pointer',
                                  active || isActiveMode
                                    ? activeClass
                                    : colors.idle
                                )}
                              >
                                <FaIcon icon={item.icon} className="text-base" />
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">{item.title}</TooltipContent>
                          </Tooltip>
                        )
                      }
                      return (
                        <div key={item.href}>
                          <Link
                            href={item.href}
                            onClick={handleClick}
                            className={cn(
                              'flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors cursor-pointer w-full text-left',
                              active || isActiveMode
                                ? activeBoldClass
                                : colors.idle
                            )}
                          >
                            <FaIcon icon={item.icon} className="w-5 text-center text-base flex-shrink-0" />
                            <span>{item.title}</span>
                          </Link>
                        </div>
                      )
                    }

                    if (!isNavGroup(item)) {
                      // Simple link
                      const active = isActive(item.href)
                      const colors = accentColor(item.roles, section.mode)
                      if (collapsed) {
                        return (
                          <Tooltip key={item.href}>
                            <TooltipTrigger asChild>
                              <Link
                                href={item.href}
                                className={cn(
                                  'flex items-center justify-center h-10 w-full rounded-md transition-colors cursor-pointer',
                                  active
                                    ? colors.active
                                    : colors.idle
                                )}
                              >
                                <FaIcon icon={item.icon} className="text-base" />
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">{item.title}</TooltipContent>
                          </Tooltip>
                        )
                      }
                      return (
                        <div key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              'flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors cursor-pointer',
                              active
                                ? colors.activeBold
                                : colors.idle
                            )}
                          >
                            <FaIcon icon={item.icon} className="w-5 text-center text-base flex-shrink-0" />
                            <span>{item.title}</span>
                          </Link>
                        </div>
                      )
                    }

                    // Nav group
                    const groupKey = item.href
                    const isExpanded = isGroupExpanded(groupKey, item)
                    const activeChild = hasActiveChild(item)
                    const submenuId = `submenu-${groupKey}`
                    const colors = accentColor(item.roles, section.mode)

                    if (collapsed) {
                      // In collapsed mode, show group icon linking to first child
                      const firstChild = item.children.find((c) => !c.requiresCreate || canCreateContent)
                      const targetHref = firstChild?.href || item.href
                      return (
                        <Tooltip key={groupKey}>
                          <TooltipTrigger asChild>
                            <Link
                              href={targetHref}
                              className={cn(
                                'flex items-center justify-center h-10 w-full rounded-md transition-colors cursor-pointer',
                                activeChild
                                  ? colors.active
                                  : colors.idle
                              )}
                            >
                              <FaIcon icon={item.icon} className="text-base" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right">{item.title}</TooltipContent>
                        </Tooltip>
                      )
                    }

                    return (
                      <div key={groupKey}>
                        <div
                          className={cn(
                            'flex items-center w-full rounded-md text-sm font-medium transition-colors cursor-pointer',
                            activeChild
                              ? colors.header
                              : colors.idle
                          )}
                          aria-expanded={isExpanded}
                          aria-controls={submenuId}
                        >
                          <button
                            onClick={() => toggleGroup(groupKey, item)}
                            className="flex items-center gap-3 flex-1 min-w-0 px-3 py-3 cursor-pointer"
                          >
                            <FaIcon icon={item.icon} className="w-5 text-center text-base" />
                            <span>{item.title}</span>
                          </button>
                          <button
                            onClick={() => toggleGroup(groupKey, item)}
                            className="px-3 py-3 cursor-pointer"
                            aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
                          >
                            <i
                              className={cn(
                                'fa-solid fa-chevron-down text-[10px] transition-transform duration-200',
                                isExpanded ? 'rotate-180' : ''
                              )}
                              aria-hidden="true"
                            />
                          </button>
                        </div>

                        <div
                          id={submenuId}
                          role="region"
                          aria-hidden={!isExpanded}
                          className={cn(
                            'overflow-hidden transition-all duration-200',
                            isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                          )}
                        >
                          <div className={cn('ml-4 pl-3 border-l mt-1 space-y-1', isRoleRestricted(item.roles) ? 'border-purple-200 dark:border-purple-800' : 'border-slate-200 dark:border-gray-700')}>
                            {item.children.filter((child) => !child.requiresCreate || canCreateContent).map((child) => {
                              return (
                                <div key={child.href}>
                                  {child.dividerBefore && (
                                    <div className="my-1 border-t border-slate-200 dark:border-gray-700" />
                                  )}
                                  <Link
                                    href={child.href}
                                    className={cn(
                                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer',
                                      isChildActive(child, item.children)
                                        ? colors.activeBold
                                        : colors.childIdle
                                    )}
                                    tabIndex={isExpanded ? 0 : -1}
                                  >
                                    <FaIcon icon={child.icon} className={cn("w-5 text-center text-base", child.iconClassName)} />
                                    <span>{child.title}</span>
                                  </Link>
                                  {child.dividerAfter && (
                                    <div className="my-1 border-t border-slate-200 dark:border-gray-700" />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-slate-200 dark:border-gray-800 p-2">
          {collapsed ? (
            <div className="space-y-1">
              {currentTourRoute && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleStartTour}
                      className="flex items-center justify-center h-10 w-full rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100 cursor-pointer"
                    >
                      <FaIcon icon="fa-light fa-compass" className="text-base" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Guided Tour</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/profile"
                    className="flex items-center justify-center h-10 w-full rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100 cursor-pointer"
                  >
                    <FaIcon icon="fa-light fa-gear" className="text-base" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">My Profile Settings</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => signOut({ callbackUrl: '/api/auth/sso-redirect?action=logout&next=/login' })}
                    className="flex items-center justify-center h-10 w-full rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100 cursor-pointer"
                  >
                    <FaIcon icon="fa-light fa-right-from-bracket" className="text-base" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                  <i className="fa-light fa-circle-user text-xl text-gray-600 dark:text-gray-400" aria-hidden="true" />
                </div>
                <div className="flex-1 truncate">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {session?.user?.name || session?.user?.email}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{session?.user?.email}</p>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {currentTourRoute && (
                  <button
                    onClick={handleStartTour}
                    className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100 cursor-pointer"
                  >
                    <FaIcon icon="fa-light fa-compass" className="w-5 text-center text-base" />
                    Guided Tour
                  </button>
                )}
                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100 cursor-pointer"
                >
                  <FaIcon icon="fa-light fa-gear" className="w-5 text-center text-base" />
                  My Profile Settings
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/api/auth/sso-redirect?action=logout&next=/login' })}
                  className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100 cursor-pointer"
                >
                  <FaIcon icon="fa-light fa-right-from-bracket" className="w-5 text-center text-base" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </TooltipProvider>
  )
}
