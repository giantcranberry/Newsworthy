'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight, Star } from 'lucide-react'

export type FavoriteUserRow = {
  id: number
  email: string
  emailVerified: boolean | null
  firstName: string | null
  lastName: string | null
}

export function FavoriteUsers({ favorites }: { favorites: FavoriteUserRow[] }) {
  const [open, setOpen] = useState(false)

  if (favorites.length === 0) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-tour="admin-favorite-users">
      <Card>
        <CardHeader className={open ? 'pb-3' : 'pb-6'}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex items-center gap-2 text-left cursor-pointer"
              data-tour="admin-favorite-users-toggle"
            >
              <ChevronRight className="h-4 w-4 text-gray-400 transition-transform group-data-[state=open]:rotate-90" />
              <CardTitle className="flex items-center gap-2 text-base">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                Favorite users
              </CardTitle>
              <span className="text-xs text-gray-400 font-normal tabular-nums">
                {favorites.length}
                {!open ? ' · Click to reveal' : ''}
              </span>
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {favorites.map((user) => {
                const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
                return (
                  <Link
                    key={user.id}
                    href={`/admin/users/${user.id}`}
                    className="flex items-center gap-3 rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2.5 hover:bg-amber-50/60 dark:hover:bg-amber-950/20 transition-colors"
                  >
                    <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {fullName || user.email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {fullName ? user.email : `ID ${user.id}`}
                        {user.emailVerified ? '' : ' · pending'}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
