'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, FileText, ExternalLink, MessageSquare } from 'lucide-react'

interface TaskData {
  id: number
  title: string
  description: string | null
  priority: string
  stageId: number
  assignedTo: number | null
  createdBy: number
  createdAt: string
  updatedAt: string
  assigneeFirstName: string | null
  assigneeLastName: string | null
  assigneeEmail: string | null
  files: { id: number; filename: string; url: string; filesize: number; mimeType: string }[]
}

interface TaskNote {
  id: number
  taskId: number
  content: string
  createdBy: number
  createdAt: string
  authorFirstName: string | null
  authorLastName: string | null
  authorEmail: string | null
}

interface StageData {
  id: number
  name: string
  color: string
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
  medium: { label: 'Medium', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  high: { label: 'High', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  urgent: { label: 'Urgent', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function InboxTaskDialog({
  open,
  onOpenChange,
  taskId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: number
}) {
  const [task, setTask] = useState<TaskData | null>(null)
  const [stages, setStages] = useState<StageData[]>([])
  const [notes, setNotes] = useState<TaskNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const notesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !taskId) return

    setLoading(true)
    setError(null)

    Promise.all([
      fetch(`/api/admin/tasks/${taskId}`).then(r => r.ok ? r.json() : Promise.reject('Task not found')),
      fetch('/api/admin/tasks/stages').then(r => r.ok ? r.json() : []),
      fetch(`/api/admin/tasks/${taskId}/notes`).then(r => r.ok ? r.json() : []),
    ])
      .then(([taskData, stagesData, notesData]) => {
        setTask(taskData)
        setStages(stagesData)
        setNotes(notesData)
      })
      .catch(() => setError('Failed to load task'))
      .finally(() => setLoading(false))
  }, [open, taskId])

  const handleAddNote = async () => {
    if (!newNote.trim() || !taskId) return
    setAddingNote(true)

    const content = newNote.trim()
    setNewNote('')

    try {
      const res = await fetch(`/api/admin/tasks/${taskId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        const notesRes = await fetch(`/api/admin/tasks/${taskId}/notes`)
        if (notesRes.ok) setNotes(await notesRes.json())
        setTimeout(() => notesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    } catch {
      setNewNote(content)
    } finally {
      setAddingNote(false)
    }
  }

  const stageName = stages.find(s => s.id === task?.stageId)?.name || '—'
  const stageColor = stages.find(s => s.id === task?.stageId)?.color || '#6b7280'
  const priority = PRIORITY_CONFIG[task?.priority || 'medium'] || PRIORITY_CONFIG.medium
  const assigneeName = task?.assigneeFirstName || task?.assigneeLastName
    ? `${task?.assigneeFirstName || ''} ${task?.assigneeLastName || ''}`.trim()
    : task?.assigneeEmail || 'Unassigned'

  const getNoteName = (note: TaskNote) => {
    if (note.authorFirstName || note.authorLastName) {
      return `${note.authorFirstName || ''} ${note.authorLastName || ''}`.trim()
    }
    return note.authorEmail || 'Unknown'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            {error}
          </div>
        ) : task ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">{task.title}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-white"
                  style={{ backgroundColor: stageColor }}
                >
                  {stageName}
                </span>
                <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${priority.bg} ${priority.color}`}>
                  {priority.label}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Assigned to: <span className="font-medium text-gray-700 dark:text-gray-300">{assigneeName}</span>
                </span>
              </div>

              {/* Description — task descriptions are server-generated HTML from TinyMCE by admin/editor users */}
              {task.description && (
                <div
                  className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-950"
                  dangerouslySetInnerHTML={{ __html: task.description }}
                />
              )}

              {/* Files */}
              {task.files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Files</p>
                  {task.files.map((file) => (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-950 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      <span className="flex-1 text-cyan-700 dark:text-cyan-400 truncate">{file.filename}</span>
                      <span className="text-gray-400 text-xs flex-shrink-0">{formatFileSize(file.filesize)}</span>
                    </a>
                  ))}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Notes ({notes.length})
                </p>

                {notes.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-lg p-2">
                    {notes.map((note) => (
                      <div key={note.id} className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{getNoteName(note)}</span>
                          <span className="text-xs text-gray-400">{formatDate(note.createdAt)}</span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{note.content}</p>
                      </div>
                    ))}
                    <div ref={notesEndRef} />
                  </div>
                )}

                {/* Add note */}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="flex-1 min-h-[60px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        handleAddNote()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddNote}
                    disabled={addingNote || !newNote.trim()}
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Footer link */}
              <div className="pt-2 border-t flex justify-end">
                <a
                  href="/admin/tasks"
                  className="inline-flex items-center gap-1.5 text-sm text-cyan-700 dark:text-cyan-400 hover:underline"
                >
                  Open Task Board
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
