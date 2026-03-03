'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { signOut, useSession } from 'next-auth/react'
import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface NavChild {
  title: string
  href: string
  icon: string
  requiresCreate?: boolean
  matchPaths?: string[]
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

interface NavSection {
  label: string
  items: (NavGroup | NavLink)[]
}

function isNavGroup(item: NavGroup | NavLink): item is NavGroup {
  return 'children' in item && item.children !== undefined
}

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
        icon: 'fa-light fa-shield-halved',
        roles: ['admin', 'editor'],
      },
    ],
  },
  {
    label: '',
    items: [
      {
        title: 'Press Releases',
        href: '/pr',
        icon: 'fa-light fa-newspaper',
        children: [
          { title: 'All Releases', href: '/pr', icon: 'fa-light fa-file-lines' },
          { title: 'Create New', href: '/pr/create', icon: 'fa-light fa-file-circle-plus', requiresCreate: true },
          { title: 'Drafts', href: '/pr/drafts', icon: 'fa-light fa-file-pen', requiresCreate: true },
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
    ],
  },
  {
    label: '',
    items: [
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
      {
        title: 'Editorial',
        href: '/editorial',
        icon: 'fa-light fa-clipboard-check',
        roles: ['editor', 'admin'],
        children: [
          { title: 'Queue', href: '/editorial/queue', icon: 'fa-light fa-clipboard-list' },
          { title: 'Enhanced Queue', href: '/editorial/queue-enhanced', icon: 'fa-light fa-clipboard-list-check' },
          { title: 'Approved Pending', href: '/editorial/pending', icon: 'fa-light fa-clock' },
          { title: 'Edit Released', href: '/editorial/released-edit', icon: 'fa-light fa-pen-to-square' },
        ],
      },
      {
        title: 'Admin',
        href: '/admin',
        icon: 'fa-light fa-gear',
        roles: ['admin'],
        children: [
          { title: 'Users', href: '/admin/users', icon: 'fa-light fa-users' },
          { title: 'Brands', href: '/admin/brands', icon: 'fa-light fa-flag' },
          { title: 'Partners', href: '/admin/partners', icon: 'fa-light fa-handshake' },
          { title: 'Products', href: '/admin/products', icon: 'fa-light fa-credit-card' },
          { title: 'Categories', href: '/admin/categories', icon: 'fa-light fa-tags' },
          { title: 'Email Templates', href: '/admin/email-templates', icon: 'fa-light fa-envelope-open-text' },
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
    ],
  },
]

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
  const { data: session } = useSession()
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

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

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn(
        'flex h-full flex-col border-r border-slate-200 bg-white transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}>
        {/* Logo */}
        <div className={cn(
          'flex h-16 items-center border-b border-slate-200',
          collapsed ? 'justify-center px-2' : 'px-6'
        )}>
          <Link href="/dashboard">
            {collapsed ? (
              <Image src="https://cdn.newsramp.app/logos/168-1769471247932.png" alt="Newsworthy" width={28} height={28} priority className="rounded-full" />
            ) : (
              <Image src="/logo.svg" alt="Newsworthy" width={225} height={42} priority />
            )}
          </Link>
        </div>

        {/* Collapse toggle */}
        {onToggleCollapse && (
          <div className={cn('border-b border-slate-200', collapsed ? 'p-2' : 'px-4 py-2')}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleCollapse}
                  className={cn(
                    'flex items-center h-8 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer transition-colors',
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
          {navSections.map((section, sectionIdx) => {
            const visibleItems = section.items.filter((item) => hasAccess(item.roles))
            if (visibleItems.length === 0) return null

            return (
              <div key={section.label || `section-${sectionIdx}`}>
                {section.label && !collapsed && (
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">
                    {section.label}
                  </h3>
                )}
                {section.label && collapsed && (
                  <div className="my-2 border-t border-slate-200" />
                )}
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    if (!isNavGroup(item)) {
                      // Simple link
                      const active = isActive(item.href)
                      if (collapsed) {
                        return (
                          <Tooltip key={item.href}>
                            <TooltipTrigger asChild>
                              <Link
                                href={item.href}
                                className={cn(
                                  'flex items-center justify-center h-10 w-full rounded-md transition-colors cursor-pointer',
                                  active
                                    ? 'bg-cyan-800/10 text-cyan-800'
                                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
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
                                ? 'bg-cyan-800/10 text-cyan-800 font-semibold'
                                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
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
                                  ? 'bg-cyan-800/10 text-cyan-800'
                                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
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
                        <button
                          onClick={() => toggleGroup(groupKey, item)}
                          className={cn(
                            'flex items-center justify-between w-full px-3 py-3 rounded-md text-sm font-medium transition-colors cursor-pointer',
                            activeChild
                              ? 'text-cyan-800 bg-gray-50'
                              : 'text-gray-700 hover:bg-gray-100'
                          )}
                          aria-expanded={isExpanded}
                          aria-controls={submenuId}
                        >
                          <div className="flex items-center gap-3">
                            <FaIcon icon={item.icon} className="w-5 text-center text-base" />
                            <span>{item.title}</span>
                          </div>
                          <i
                            className={cn(
                              'fa-solid fa-chevron-down text-[10px] transition-transform duration-200',
                              isExpanded ? 'rotate-180' : ''
                            )}
                            aria-hidden="true"
                          />
                        </button>

                        <div
                          id={submenuId}
                          role="region"
                          aria-hidden={!isExpanded}
                          className={cn(
                            'overflow-hidden transition-all duration-200',
                            isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                          )}
                        >
                          <div className="ml-4 pl-3 border-l border-slate-200 mt-1 space-y-1">
                            {item.children.filter((child) => !child.requiresCreate || canCreateContent).map((child) => {
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className={cn(
                                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer',
                                    isChildActive(child, item.children)
                                      ? 'bg-cyan-800/10 text-cyan-800 font-semibold'
                                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                  )}
                                  tabIndex={isExpanded ? 0 : -1}
                                >
                                  <FaIcon icon={child.icon} className="w-5 text-center text-base" />
                                  <span>{child.title}</span>
                                </Link>
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
        <div className="border-t border-slate-200 p-2">
          {collapsed ? (
            <div className="space-y-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/profile"
                    className="flex items-center justify-center h-10 w-full rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                  >
                    <FaIcon icon="fa-light fa-gear" className="text-base" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">My Profile</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="flex items-center justify-center h-10 w-full rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
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
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                  <i className="fa-light fa-circle-user text-xl text-gray-600" aria-hidden="true" />
                </div>
                <div className="flex-1 truncate">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {session?.user?.name || session?.user?.email}
                  </p>
                  <p className="text-xs text-gray-600 truncate">{session?.user?.email}</p>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                >
                  <FaIcon icon="fa-light fa-gear" className="w-5 text-center text-base" />
                  My Profile
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
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
