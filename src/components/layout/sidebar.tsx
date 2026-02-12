'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  Building2,
  Users,
  ShoppingCart,
  Settings,
  Database,
  Megaphone,
  ClipboardCheck,
  CreditCard,
  ChevronDown,
  LogOut,
  User,
} from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import { useState } from 'react'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  children?: NavItem[]
  roles?: string[]
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Press Releases',
    href: '/pr',
    icon: FileText,
    children: [
      { title: 'All Releases', href: '/pr', icon: FileText },
      { title: 'Create New', href: '/pr/create', icon: FileText },
      { title: 'Drafts', href: '/pr/drafts', icon: FileText },
    ],
  },
  {
    title: 'Brands',
    href: '/company',
    icon: Building2,
    children: [
      { title: 'All Brands', href: '/company', icon: Building2 },
      { title: 'Add Brand', href: '/company/add', icon: Building2 },
    ],
  },
  {
    title: 'Editorial',
    href: '/editorial',
    icon: ClipboardCheck,
    roles: ['editor', 'admin', 'staff'],
    children: [
      { title: 'Queue', href: '/editorial/queue', icon: ClipboardCheck },
      { title: 'Enhanced Queue', href: '/editorial/queue-enhanced', icon: ClipboardCheck },
    ],
  },
  {
    title: 'Admin',
    href: '/admin',
    icon: Settings,
    roles: ['admin'],
    children: [
      { title: 'Users', href: '/admin/users', icon: Users },
      { title: 'Brands', href: '/admin/brands', icon: Building2 },
      { title: 'Partners', href: '/admin/partners', icon: Building2 },
      { title: 'Products', href: '/admin/products', icon: CreditCard },
      { title: 'Categories', href: '/admin/categories', icon: Database },
    ],
  },
]

function NavItemComponent({ item, isChild = false }: { item: NavItem; isChild?: boolean }) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const { data: session } = useSession()

  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const hasChildren = item.children && item.children.length > 0

  // Check role-based access
  if (item.roles) {
    const userRoles: string[] = []
    if ((session?.user as any)?.isAdmin) userRoles.push('admin')
    if ((session?.user as any)?.isEditor) userRoles.push('editor')
    if ((session?.user as any)?.isStaff) userRoles.push('staff')

    if (!item.roles.some((role) => userRoles.includes(role))) {
      return null
    }
  }

  const Icon = item.icon

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
            isActive
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          )}
        >
          <span className="flex items-center gap-3">
            <Icon className="h-5 w-5" />
            {item.title}
          </span>
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
          />
        </button>
        {isOpen && (
          <div className="ml-6 mt-1 space-y-1">
            {item.children?.map((child) => (
              <NavItemComponent key={child.href} item={child} isChild />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-gray-100 text-gray-900 font-medium'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
        isChild && 'text-sm'
      )}
    >
      {!isChild && <Icon className="h-5 w-5" />}
      {item.title}
    </Link>
  )
}

export function Sidebar() {
  const { data: session } = useSession()

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-100 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-100 px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Megaphone className="h-8 w-8 text-blue-600" />
          <span className="text-xl font-bold">Newsworthy</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavItemComponent key={item.href} item={item} />
          ))}
        </div>
      </nav>

      {/* User section */}
      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
            <User className="h-5 w-5 text-gray-600" />
          </div>
          <div className="flex-1 truncate">
            <p className="text-sm font-medium text-gray-900 truncate">
              {session?.user?.name || session?.user?.email}
            </p>
            <p className="text-xs text-gray-500 truncate">{session?.user?.email}</p>
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
