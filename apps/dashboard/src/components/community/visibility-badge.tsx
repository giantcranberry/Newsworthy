'use client'

import { cn } from '@/lib/utils'
import { Globe, Users, Eye } from 'lucide-react'

interface VisibilityBadgeProps {
  visibility: string
  className?: string
}

const config: Record<string, { label: string; icon: typeof Globe; color: string }> = {
  public: { label: 'Public', icon: Globe, color: 'text-green-600 dark:text-green-400 bg-green-50' },
  team: { label: 'Team', icon: Users, color: 'text-blue-600 dark:text-blue-400 bg-blue-50' },
  followers: { label: 'Followers', icon: Eye, color: 'text-purple-600 bg-purple-50' },
}

export function VisibilityBadge({ visibility, className }: VisibilityBadgeProps) {
  const c = config[visibility] || config.public
  const Icon = c.icon

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', c.color, className)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  )
}
