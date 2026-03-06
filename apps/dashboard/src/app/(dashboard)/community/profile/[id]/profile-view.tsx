'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserAvatar } from '@/components/community/user-avatar'
import { FollowButton } from '@/components/community/follow-button'
import { CommunityFeed } from '@/components/community/community-feed'
import { FollowersList } from './followers-list'

interface Profile {
  id: number
  name: string
  avatar?: string | null
  emailHash?: string | null
  bio?: string | null
  acctHandle?: string | null
  company?: string | null
  location?: string | null
  followerCount: number
  followingCount: number
}

interface ProfileViewProps {
  profile: Profile
  currentUserId: number
  isFollowing: boolean
  isAdmin?: boolean
}

export function ProfileView({ profile, currentUserId, isFollowing, isAdmin }: ProfileViewProps) {
  const router = useRouter()
  const isOwnProfile = profile.id === currentUserId

  const handleStartChat = async () => {
    const res = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.id }),
    })
    if (res.ok) {
      const data = await res.json()
      router.push(`/community/chat/${data.uuid}`)
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/community"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Community
      </Link>

      {/* Profile header */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-start gap-4">
          <UserAvatar name={profile.name} avatar={profile.avatar} emailHash={profile.emailHash} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{profile.name}</h1>
            {profile.acctHandle && (
              <p className="text-sm text-gray-500 dark:text-gray-400">@{profile.acctHandle}</p>
            )}
            {(profile.company || profile.location) && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {[profile.company, profile.location].filter(Boolean).join(' · ')}
              </p>
            )}
            {profile.bio && (
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{profile.bio}</p>
            )}

            <div className="flex items-center gap-4 mt-3 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-gray-100">{profile.followerCount}</strong> followers
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-gray-100">{profile.followingCount}</strong> following
              </span>
            </div>

            {!isOwnProfile && (
              <div className="flex items-center gap-2 mt-4">
                <FollowButton userId={profile.id} isFollowing={isFollowing} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartChat}
                  className="gap-1.5 text-gray-700 dark:text-gray-300"
                >
                  <MessageCircle className="h-4 w-4" />
                  Message
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="posts">
        <TabsList className="bg-gray-100 dark:bg-gray-800">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="followers">Followers</TabsTrigger>
          <TabsTrigger value="following">Following</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-4">
          <CommunityFeed
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            userId={profile.id}
          />
        </TabsContent>

        <TabsContent value="followers" className="mt-4">
          <FollowersList userId={profile.id} type="followers" />
        </TabsContent>

        <TabsContent value="following" className="mt-4">
          <FollowersList userId={profile.id} type="following" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
