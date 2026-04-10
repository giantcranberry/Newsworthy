'use client'

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { setupSchemaPlugin } from '@/lib/tinymce-schema-plugin'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { MoreHorizontal, Pin, Pencil, Trash2, MessageSquare, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { UserAvatar } from './user-avatar'
import { VisibilityBadge } from './visibility-badge'
import { PostImages } from './post-images'
import { ReactionBar } from './reaction-bar'
import { linkifyHtml } from '@/lib/linkify-html'

const Editor = dynamic(
  () => import('@tinymce/tinymce-react').then((mod) => mod.Editor),
  { ssr: false }
)

interface PostImage {
  id: number
  url: string
  caption?: string | null
  width?: number | null
  height?: number | null
}

interface Board {
  id: number
  name: string
  slug: string
  color: string
}

interface Post {
  id: number
  uuid: string
  boardId?: number
  boardName: string
  boardSlug: string
  boardColor: string
  userId: number
  userName: string
  userAvatar?: string | null
  userEmailHash?: string | null
  userHandle?: string | null
  userLocation?: string | null
  body: string
  visibility: string
  isPinned: boolean
  commentCount: number
  reactionCount: number
  images: PostImage[]
  createdAt: string
  userReactions?: string[]
}

interface PostCardProps {
  post: Post
  currentUserId: number
  isAdmin?: boolean
  showBoard?: boolean
  boards?: Board[]
  onDelete?: (uuid: string) => void
  onBoardChange?: (uuid: string, boardId: number, boardName: string, boardSlug: string, boardColor: string) => void
}

export function PostCard({ post, currentUserId, isAdmin, showBoard = true, boards, onDelete, onBoardChange }: PostCardProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const editorRef = useRef<any>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pinned, setPinned] = useState(post.isPinned)
  const [body, setBody] = useState(post.body)
  const [boardName, setBoardName] = useState(post.boardName)
  const [boardSlug, setBoardSlug] = useState(post.boardSlug)
  const [boardColor, setBoardColor] = useState(post.boardColor)
  const [editing, setEditing] = useState(false)
  const [editBoardId, setEditBoardId] = useState<number | undefined>(post.boardId)
  const [editHasContent, setEditHasContent] = useState(false)
  const [saving, setSaving] = useState(false)
  const isOwner = post.userId === Number(currentUserId)

  const timeAgo = getTimeAgo(new Date(post.createdAt))

  const handlePin = async () => {
    setMenuOpen(false)
    const res = await fetch(`/api/community/posts/${post.uuid}/pin`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setPinned(data.isPinned)
    }
  }

  const handleDelete = async () => {
    setMenuOpen(false)
    if (!confirm('Delete this post?')) return
    const res = await fetch(`/api/community/posts/${post.uuid}`, { method: 'DELETE' })
    if (res.ok) {
      onDelete?.(post.uuid)
    }
  }

  const handleEdit = () => {
    setMenuOpen(false)
    setEditHasContent(true)
    setEditing(true)
  }

  const handleCancelEdit = () => {
    setEditing(false)
  }

  const handleSaveEdit = async () => {
    const content = editorRef.current?.getContent() || ''
    const plainText = content.replace(/<[^>]*>/g, '').trim()
    if (!plainText) return

    setSaving(true)
    try {
      const payload: Record<string, any> = { body: content }
      if (isAdmin && editBoardId && editBoardId !== post.boardId) {
        payload.boardId = editBoardId
      }
      const res = await fetch(`/api/community/posts/${post.uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setBody(content)
        if (isAdmin && editBoardId && editBoardId !== post.boardId && boards) {
          const newBoard = boards.find(b => b.id === editBoardId)
          if (newBoard) {
            setBoardName(newBoard.name)
            setBoardSlug(newBoard.slug)
            setBoardColor(newBoard.color)
            onBoardChange?.(post.uuid, newBoard.id, newBoard.name, newBoard.slug, newBoard.color)
          }
        }
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn(
      'rounded-lg border bg-white dark:bg-gray-900 p-4',
      pinned ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 dark:border-gray-800'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/community/profile/${post.userId}`}>
            <UserAvatar name={post.userName} avatar={post.userAvatar} emailHash={post.userEmailHash} size="md" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/community/profile/${post.userId}`}
                className="font-medium text-gray-900 dark:text-gray-100 hover:text-cyan-800 dark:text-cyan-400 text-sm"
              >
                {post.userName}
              </Link>
              {post.userHandle && (
                <span className="text-xs text-gray-400">@{post.userHandle}</span>
              )}
              {post.visibility !== 'public' && <VisibilityBadge visibility={post.visibility} />}
              {pinned && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                  <Pin className="h-3 w-3" /> Pinned
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {showBoard && (
                <>
                  <Link
                    href={`/community/boards/${boardSlug}`}
                    className="hover:text-cyan-800 dark:text-cyan-400"
                    style={{ color: boardColor }}
                  >
                    {boardName}
                  </Link>
                  <span>&middot;</span>
                </>
              )}
              <span>{timeAgo}</span>
              {post.userLocation && (
                <>
                  <span>&middot;</span>
                  <span>{post.userLocation}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {(isOwner || isAdmin) && !editing && (
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600 dark:text-gray-400">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-40 p-1 bg-white dark:bg-gray-900">
              {isAdmin && (
                <button
                  onClick={handlePin}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800"
                >
                  <Pin className="h-4 w-4" />
                  {pinned ? 'Unpin' : 'Pin'}
                </button>
              )}
              {(isOwner || isAdmin) && (
                <button
                  onClick={handleEdit}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              )}
              {(isOwner || isAdmin) && (
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Images */}
      <PostImages images={post.images} />

      {/* Body */}
      {editing ? (
        <div className="mt-3">
          {isAdmin && boards && boards.length > 0 && (
            <div className="mb-3">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Move to board</label>
              <select
                value={editBoardId ?? ''}
                onChange={(e) => setEditBoardId(Number(e.target.value))}
                className="w-full max-w-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <Editor
            key={isDark ? 'dark' : 'light'}
            apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || 'no-api-key'}
            onInit={(_evt, editor) => (editorRef.current = editor)}
            initialValue={body}
            onEditorChange={(content) => {
              const text = content.replace(/<[^>]*>/g, '').trim()
              setEditHasContent(!!text)
            }}
            init={{
              height: 200,
              menubar: false,
              skin: isDark ? 'oxide-dark' : 'oxide',
              content_css: isDark ? 'dark' : 'default',
              plugins: ['autolink', 'lists', 'link'],
              toolbar: 'blocks | bold italic | bullist numlist | blockquote link schemaAttrs | removeformat',
              setup: (editor: any) => { setupSchemaPlugin(editor); },
              block_formats: 'Normal=p; Heading 2=h2; Heading 3=h3',
              extended_valid_elements: '@[itemscope|itemtype|itemid|itemprop|content],a[href|target|rel|itemscope|itemtype|itemprop|class],div[*],span[*],time[datetime|*]',
              link_rel_list: [
                { title: 'None', value: '' },
                { title: 'No Follow', value: 'nofollow' },
                { title: 'Sponsored', value: 'sponsored' },
                { title: 'UGC', value: 'ugc' },
                { title: 'No Follow + Sponsored', value: 'nofollow sponsored' },
              ],
              placeholder: 'Edit your post...',
              content_style: isDark
                ? 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.6; background-color: #111827; color: #e5e7eb; }'
                : 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.6; }',
              branding: false,
              statusbar: false,
            }}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelEdit}
              disabled={saving}
              className="gap-1.5 text-gray-500"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={saving || !editHasContent}
              className="gap-1.5 bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
            >
              <Check className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="mt-3 text-sm text-gray-800 dark:text-gray-200 break-words prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: linkifyHtml(body) }}
        />
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-3">
        <ReactionBar
          targetType="post"
          targetId={post.id}
          reactionCount={post.reactionCount}
          userReactions={post.userReactions}
        />

        <Link
          href={`/community/posts/${post.uuid}`}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-cyan-800 dark:text-cyan-400 transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
          {post.commentCount > 0 ? `${post.commentCount} comments` : 'Comment'}
        </Link>
      </div>
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}
