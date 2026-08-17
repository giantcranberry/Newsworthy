'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Users, FileText, Building2, Briefcase, ChevronRight, BarChart3 } from 'lucide-react'

interface AdminStatsProps {
  users: number
  releases: number
  companies: number
  partners: number
}

export function AdminStats({ users, releases, companies, partners }: AdminStatsProps) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-tour="admin-stats">
      <Card>
        <CardHeader className={open ? 'pb-3' : 'pb-6'}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex items-center gap-2 text-left cursor-pointer"
              data-tour="admin-stats-toggle"
            >
              <ChevronRight className="h-4 w-4 text-gray-400 transition-transform group-data-[state=open]:rotate-90" />
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-gray-400" />
                Platform Stats
              </CardTitle>
              {!open && (
                <span className="text-xs text-gray-400 font-normal">Click to reveal</span>
              )}
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div
                data-tour="admin-stat-users"
                className="rounded-lg border border-gray-200 dark:border-gray-800 p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{users}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Users</p>
                  </div>
                </div>
              </div>

              <div
                data-tour="admin-stat-releases"
                className="rounded-lg border border-gray-200 dark:border-gray-800 p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{releases}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Releases</p>
                  </div>
                </div>
              </div>

              <div
                data-tour="admin-stat-companies"
                className="rounded-lg border border-gray-200 dark:border-gray-800 p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{companies}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Companies</p>
                  </div>
                </div>
              </div>

              <div
                data-tour="admin-stat-partners"
                className="rounded-lg border border-gray-200 dark:border-gray-800 p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <Briefcase className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{partners}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Partners</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
