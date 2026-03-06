'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const themes = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return collapsed ? (
      <div className="flex items-center justify-center h-10 w-full" />
    ) : (
      <div className="h-9 w-full rounded-lg bg-gray-100 dark:bg-gray-800" />
    )
  }

  if (collapsed) {
    const current = themes.find((t) => t.value === theme) || themes[2]
    const Icon = current.icon
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setTheme(nextTheme)}
            className="flex items-center justify-center h-10 w-full rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 cursor-pointer transition-colors"
          >
            <Icon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          Theme: {current.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="flex items-center rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
      {themes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer',
            theme === value
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
          title={label}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}
