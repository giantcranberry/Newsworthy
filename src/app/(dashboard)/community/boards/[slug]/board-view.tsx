'use client'

import { useState } from 'react'
import { BoardHeader } from '@/components/community/board-header'
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
  rules: string | null
  staffOnly: boolean
}

interface SmallBoard {
  id: number
  name: string
  slug: string
  color: string
  staffOnly?: boolean
}

interface Company {
  id: number
  companyName: string
}

interface BoardViewProps {
  board: Board
  allBoards: SmallBoard[]
  companies: Company[]
  currentUserId: number
  isAdmin?: boolean
  isStaff?: boolean
  guidelinesAccepted: boolean
  guidelinesBody: string
}

export function BoardView({
  board,
  allBoards,
  companies,
  currentUserId,
  isAdmin,
  isStaff,
  guidelinesAccepted: initialAccepted,
  guidelinesBody,
}: BoardViewProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [accepted, setAccepted] = useState(initialAccepted)

  return (
    <div className="space-y-6">
      <BoardHeader board={board} />

      {!accepted && guidelinesBody ? (
        <GuidelinesAcceptance
          body={guidelinesBody}
          onAccept={() => setAccepted(true)}
        />
      ) : (
        <PostForm
          boards={allBoards}
          companies={companies}
          defaultBoardId={board.id}
          isStaff={isStaff}
          onPostCreated={() => setRefreshKey((k) => k + 1)}
        />
      )}

      <CommunityFeed
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        boardSlug={board.slug}
        refreshKey={refreshKey}
      />
    </div>
  )
}
