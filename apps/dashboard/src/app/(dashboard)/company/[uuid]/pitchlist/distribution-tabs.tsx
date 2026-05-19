'use client'

import { useState } from 'react'
import { Newspaper, Users } from 'lucide-react'
import { PitchListForm } from './pitchlist-form'
import { ShareListForm } from '../advocacy/advocacy-form'

interface DistributionTabsProps {
  readOnly?: boolean
  companyUuid: string
  companyName: string
  totalContacts: number
  shareGroup: {
    id: number
    inviteMsg: string
  }
  totalSubscribers: number
}

export function DistributionTabs({
  readOnly,
  companyUuid,
  companyName,
  totalContacts,
  shareGroup,
  totalSubscribers,
}: DistributionTabsProps) {
  const [activeTab, setActiveTab] = useState<'pitch' | 'share'>('share')

  return (
    <div className="space-y-6">
      <div className="flex w-full rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('pitch')}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all cursor-pointer ${
            activeTab === 'pitch'
              ? 'bg-cyan-700 text-white shadow-sm dark:shadow-gray-900/50'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100'
          }`}
        >
          <Newspaper className="h-4 w-4" />
          Media Pitch List
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('share')}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all cursor-pointer ${
            activeTab === 'share'
              ? 'bg-cyan-700 text-white shadow-sm dark:shadow-gray-900/50'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100'
          }`}
        >
          <Users className="h-4 w-4" />
          Share List
        </button>
      </div>

      {activeTab === 'pitch' ? (
        <PitchListForm
          readOnly={readOnly}
          companyUuid={companyUuid}
          companyName={companyName}
          totalContacts={totalContacts}
        />
      ) : (
        <ShareListForm
          readOnly={readOnly}
          companyUuid={companyUuid}
          companyName={companyName}
          group={shareGroup}
          totalSubscribers={totalSubscribers}
        />
      )}
    </div>
  )
}
