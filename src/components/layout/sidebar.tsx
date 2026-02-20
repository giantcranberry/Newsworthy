'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { signOut, useSession } from 'next-auth/react'
import { useState } from 'react'

interface NavChild {
  title: string
  href: string
  icon: string
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
    ],
  },
  {
    label: 'Content',
    items: [
      {
        title: 'Press Releases',
        href: '/pr',
        icon: 'fa-light fa-newspaper',
        children: [
          { title: 'All Releases', href: '/pr', icon: 'fa-light fa-file-lines' },
          { title: 'Create New', href: '/pr/create', icon: 'fa-light fa-file-circle-plus' },
          { title: 'Drafts', href: '/pr/drafts', icon: 'fa-light fa-file-pen' },
        ],
      },
      {
        title: 'Brands',
        href: '/company',
        icon: 'fa-light fa-flag',
        children: [
          { title: 'All Brands', href: '/company', icon: 'fa-light fa-flag' },
          { title: 'Add Brand', href: '/company/add', icon: 'fa-light fa-flag' },
        ],
      },
    ],
  },
  {
    label: 'Editorial',
    items: [
      {
        title: 'Editorial',
        href: '/editorial',
        icon: 'fa-light fa-clipboard-check',
        roles: ['editor', 'admin', 'staff'],
        children: [
          { title: 'Queue', href: '/editorial/queue', icon: 'fa-light fa-clipboard-list' },
          { title: 'Enhanced Queue', href: '/editorial/queue-enhanced', icon: 'fa-light fa-clipboard-list-check' },
        ],
      },
    ],
  },
  {
    label: 'Admin',
    items: [
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
        ],
      },
    ],
  },
]

function FaIcon({ icon, className }: { icon: string; className?: string }) {
  return <i className={cn(icon, className)} aria-hidden="true" />
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === path
    return pathname === path || pathname.startsWith(path + '/')
  }

  const isChildActive = (child: NavChild, siblings: NavChild[]) => {
    if (pathname === child.href) return true
    // Only use startsWith if no sibling matches more specifically
    if (pathname.startsWith(child.href + '/')) {
      const hasBetterMatch = siblings.some(
        (s) => s.href !== child.href && (pathname === s.href || pathname.startsWith(s.href + '/'))
        && s.href.length > child.href.length
      )
      return !hasBetterMatch
    }
    return false
  }

  const hasActiveChild = (item: NavGroup) => {
    return item.children.some((child) => isChildActive(child, item.children))
  }

  const isGroupExpanded = (key: string, item: NavGroup): boolean => {
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
    return roles
  }

  const hasAccess = (roles?: string[]) => {
    if (!roles) return true
    const userRoles = getUserRoles()
    return roles.some((role) => userRoles.includes(role))
  }

  const renderNavLink = (href: string, label: string, icon: string, active: boolean) => (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors cursor-pointer',
        active
          ? 'bg-cyan-800/10 text-cyan-800 font-semibold'
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
      )}
    >
      <FaIcon icon={icon} className="w-5 text-center text-base flex-shrink-0" />
      <span>{label}</span>
    </Link>
  )

  return (
    <div className="flex h-full w-60 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-slate-200 px-6">
        <Link href="/dashboard">
          <Image src="/logo.svg" alt="Newsworthy" width={225} height={42} priority />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {navSections.map((section) => {
          const visibleItems = section.items.filter((item) => hasAccess(item.roles))
          if (visibleItems.length === 0) return null

          return (
            <div key={section.label || 'main'}>
              {section.label && (
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">
                  {section.label}
                </h3>
              )}
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  if (!isNavGroup(item)) {
                    return (
                      <div key={item.href}>
                        {renderNavLink(
                          item.href,
                          item.title,
                          item.icon,
                          isActive(item.href)
                        )}
                      </div>
                    )
                  }

                  const groupKey = item.href
                  const isExpanded = isGroupExpanded(groupKey, item)
                  const activeChild = hasActiveChild(item)
                  const submenuId = `submenu-${groupKey}`

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
                          {item.children.map((child) => {
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
      <div className="border-t border-slate-200 p-4">
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
            Settings
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
          >
            <FaIcon icon="fa-light fa-right-from-bracket" className="w-5 text-center text-base" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
