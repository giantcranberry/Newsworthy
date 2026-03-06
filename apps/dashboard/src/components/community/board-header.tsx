'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface Board {
  id: number
  name: string
  slug: string
  description: string | null
  iconClass: string | null
  color: string
  rules: string | null
}

interface BoardHeaderProps {
  board: Board
}

export function BoardHeader({ board }: BoardHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: board.color + '20' }}
      >
        <i
          className={`${board.iconClass || 'fa-light fa-message'} text-xl`}
          style={{ color: board.color }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{board.name}</h1>
          {board.rules && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-gray-400 hover:text-gray-600 dark:text-gray-400 cursor-pointer">
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 bg-white dark:bg-gray-900">
                <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-2">Board Rules</h4>
                <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap prose prose-sm max-w-none">
                  {board.rules}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        {board.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{board.description}</p>
        )}
      </div>
    </div>
  )
}
