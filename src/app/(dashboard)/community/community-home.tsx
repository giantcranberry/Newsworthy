'use client'

import { useState } from 'react'
import { BoardCard } from '@/components/community/board-card'
import { PostForm } from '@/components/community/post-form'
import { CommunityFeed } from '@/components/community/community-feed'
import { GuidelinesAcceptance } from '@/components/community/guidelines-acceptance'

interface Board {
  id: number
  name: string
  slug: string
  description: string | null
  iconClass: string | null
  color: string
  staffOnly?: boolean
}

interface Company {
  id: number
  companyName: string
}

interface CommunityHomeProps {
  boards: Board[]
  companies: Company[]
  currentUserId: number
  isAdmin?: boolean
  isStaff?: boolean
  guidelinesAccepted: boolean
  guidelinesBody: string
}

export function CommunityHome({
  boards,
  companies,
  currentUserId,
  isAdmin,
  isStaff,
  guidelinesAccepted: initialAccepted,
  guidelinesBody,
}: CommunityHomeProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [accepted, setAccepted] = useState(initialAccepted)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Community</h1>
        <p className="text-gray-600 dark:text-gray-400">Connect, share ideas, and discuss with other members</p>
      </div>

      {/* Boards grid */}
      {boards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <BoardCard key={board.id} board={board} />
          ))}
        </div>
      )}

      {/* Guidelines acceptance or Post form */}
      <div className="space-y-4">
        {!accepted && guidelinesBody ? (
          <GuidelinesAcceptance
            body={guidelinesBody}
            onAccept={() => setAccepted(true)}
          />
        ) : boards.length > 0 ? (
          <PostForm
            boards={boards}
            companies={companies}
            isStaff={isStaff}
            onPostCreated={() => setRefreshKey((k) => k + 1)}
          />
        ) : null}

        <CommunityFeed
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          refreshKey={refreshKey}
        />
      </div>
    </div>
  )
}
