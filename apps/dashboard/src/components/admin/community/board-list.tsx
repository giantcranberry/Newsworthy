'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, GripVertical, Archive, ArchiveRestore, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { BoardForm } from './board-form'

interface Board {
  id: number
  uuid: string
  name: string
  slug: string
  description: string | null
  iconClass: string | null
  color: string
  rules: string | null
  staffOnly: boolean
  sortOrder: number
  isArchived: boolean
  isDeleted: boolean
}

interface BoardListProps {
  boards: Board[]
}

export function BoardList({ boards: initialBoards }: BoardListProps) {
  const router = useRouter()
  const [boards, setBoards] = useState(initialBoards)
  const [showDialog, setShowDialog] = useState(false)
  const [editingBoard, setEditingBoard] = useState<Board | null>(null)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [resetBoard, setResetBoard] = useState<Board | null>(null)
  const [resetConfirmName, setResetConfirmName] = useState('')
  const [resetting, setResetting] = useState(false)

  const handleCreate = () => {
    setEditingBoard(null)
    setShowDialog(true)
  }

  const handleEdit = (board: Board) => {
    setEditingBoard(board)
    setShowDialog(true)
  }

  const fetchBoards = async () => {
    const res = await fetch('/api/admin/community/boards')
    if (res.ok) {
      setBoards(await res.json())
    }
  }

  const handleSave = () => {
    setShowDialog(false)
    setEditingBoard(null)
    fetchBoards()
  }

  const handleDelete = async (boardId: number) => {
    if (!confirm('Are you sure you want to delete this board? Posts will be preserved.')) return

    const res = await fetch(`/api/admin/community/boards/${boardId}`, { method: 'DELETE' })
    if (res.ok) {
      setBoards(boards.filter((b) => b.id !== boardId))
    }
  }

  const handleArchiveToggle = async (board: Board) => {
    const res = await fetch(`/api/admin/community/boards/${board.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isArchived: !board.isArchived }),
    })
    if (res.ok) {
      setBoards(boards.map((b) => (b.id === board.id ? { ...b, isArchived: !b.isArchived } : b)))
    }
  }

  const handleReset = async () => {
    if (!resetBoard || resetConfirmName !== resetBoard.name) return

    setResetting(true)
    try {
      const res = await fetch(`/api/admin/community/boards/${resetBoard.id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`Board reset successfully. ${data.deletedPosts} post${data.deletedPosts !== 1 ? 's' : ''} deleted.`)
      } else {
        toast.error('Failed to reset board')
      }
    } catch {
      toast.error('Failed to reset board')
    } finally {
      setResetting(false)
      setResetBoard(null)
      setResetConfirmName('')
    }
  }

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx)
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === idx) return

    const newBoards = [...boards]
    const [dragged] = newBoards.splice(draggedIdx, 1)
    newBoards.splice(idx, 0, dragged)
    setBoards(newBoards)
    setDraggedIdx(idx)
  }

  const handleDragEnd = async () => {
    setDraggedIdx(null)
    await fetch('/api/admin/community/boards/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardIds: boards.map((b) => b.id) }),
    })
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{boards.length} board{boards.length !== 1 ? 's' : ''}</p>
        <Button onClick={handleCreate} className="gap-2 bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700">
          <Plus className="h-4 w-4" />
          Add Board
        </Button>
      </div>

      <div className="space-y-2">
        {boards.map((board, idx) => (
          <div
            key={board.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 rounded-lg border bg-white dark:bg-gray-900 p-4 transition-all ${
              board.isArchived ? 'border-gray-200 dark:border-gray-800 opacity-60' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:border-gray-700'
            } ${draggedIdx === idx ? 'shadow-lg' : ''}`}
          >
            <div className="cursor-grab text-gray-400 hover:text-gray-600 dark:text-gray-400">
              <GripVertical className="h-5 w-5" />
            </div>

            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: board.color + '20' }}
            >
              <i className={board.iconClass || 'fa-light fa-message'} style={{ color: board.color }} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">{board.name}</h3>
                {board.staffOnly && (
                  <span className="rounded-full bg-cyan-100 dark:bg-cyan-900/30 px-2 py-0.5 text-xs text-cyan-700">Staff Only</span>
                )}
                {board.isArchived && (
                  <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">Archived</span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{board.description || 'No description'}</p>
              <p className="text-xs text-gray-400">/{board.slug}</p>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleArchiveToggle(board)}
                className="h-8 w-8 text-gray-400 hover:text-gray-600 dark:text-gray-400"
                title={board.isArchived ? 'Unarchive' : 'Archive'}
              >
                {board.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEdit(board)}
                className="h-8 w-8 text-gray-400 hover:text-gray-600 dark:text-gray-400"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setResetBoard(board); setResetConfirmName('') }}
                className="h-8 w-8 text-gray-400 hover:text-orange-600"
                title="Reset board (delete all posts)"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(board.id)}
                className="h-8 w-8 text-gray-400 hover:text-red-600 dark:text-red-400"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {boards.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-8 text-center">
            <i className="fa-light fa-comments text-3xl text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No boards yet. Create your first community board.</p>
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>{editingBoard ? 'Edit Board' : 'Create Board'}</DialogTitle>
          </DialogHeader>
          <BoardForm
            board={editingBoard}
            onSave={handleSave}
            onCancel={() => setShowDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!resetBoard} onOpenChange={(open) => { if (!open) { setResetBoard(null); setResetConfirmName('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Board</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>all posts, comments, reactions, and images</strong> from{' '}
              <strong>{resetBoard?.name}</strong>. The board configuration (name, rules, etc.) will be preserved.
              <br /><br />
              Type <strong>{resetBoard?.name}</strong> to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={resetConfirmName}
            onChange={(e) => setResetConfirmName(e.target.value)}
            placeholder={resetBoard?.name}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={resetConfirmName !== resetBoard?.name || resetting}
            >
              {resetting ? 'Resetting...' : 'Reset Board'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
