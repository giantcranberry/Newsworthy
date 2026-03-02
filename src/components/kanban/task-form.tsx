'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FileText, X, Upload, Trash2, Send, MessageSquare } from 'lucide-react'
import type { Stage } from './stage-manager'

const Editor = dynamic(
  () => import('@tinymce/tinymce-react').then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] bg-gray-50 rounded border border-gray-200 animate-pulse" />
    ),
  }
)

interface EditorialUser {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
}

interface TaskFile {
  id: number
  taskId: number
  filename: string
  url: string
  filesize: number
  mimeType: string
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

export interface BrandCompany {
  id: number
  companyName: string
}

export interface KanbanTask {
  id: number
  stageId: number
  title: string
  description: string | null
  priority: string
  assignedTo: number | null
  createdBy: number
  companyId: number | null
  companyName: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  assigneeFirstName: string | null
  assigneeLastName: string | null
  assigneeEmail: string | null
  files: TaskFile[]
  noteCount?: number
}

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-gray-500', bg: 'bg-gray-100', dot: 'bg-gray-400' },
  { value: 'medium', label: 'Medium', color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  { value: 'high', label: 'High', color: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-500' },
] as const

export function getPriorityConfig(priority: string) {
  return PRIORITY_OPTIONS.find((p) => p.value === priority) || PRIORITY_OPTIONS[1]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  stages,
  users,
  companies = [],
  defaultStageId,
  currentUserId,
  onSaved,
  apiBase,
  showAssignee = true,
  showBrandSelector = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: KanbanTask | null
  stages: Stage[]
  users: EditorialUser[]
  companies?: BrandCompany[]
  defaultStageId?: number
  currentUserId: number | null
  onSaved: () => void
  apiBase: string
  showAssignee?: boolean
  showBrandSelector?: boolean
}) {
  const editorRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [stageId, setStageId] = useState<number>(0)
  const [assignedTo, setAssignedTo] = useState<string>('')
  const [companyId, setCompanyId] = useState<string>('')
  const [existingFiles, setExistingFiles] = useState<TaskFile[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)

  // Notes
  const [notes, setNotes] = useState<TaskNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const notesEndRef = useRef<HTMLDivElement>(null)

  const isCreator = task ? task.createdBy === currentUserId : false

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      if (task) {
        setTitle(task.title)
        setPriority(task.priority || 'medium')
        setStageId(task.stageId)
        setAssignedTo(task.assignedTo ? String(task.assignedTo) : '')
        setCompanyId(task.companyId ? String(task.companyId) : '')
        setExistingFiles(task.files || [])
        fetchNotes(task.id)
      } else {
        setTitle('')
        setPriority('medium')
        setStageId(defaultStageId || stages[0]?.id || 0)
        setAssignedTo('')
        setCompanyId('')
        setExistingFiles([])
        setNotes([])
      }
      setNewFiles([])
      setNewNote('')
      setError(null)
    }
  }, [open, task, stages, defaultStageId])

  const fetchNotes = async (taskId: number) => {
    try {
      const res = await fetch(`${apiBase}/${taskId}/notes`)
      if (res.ok) setNotes(await res.json())
    } catch (err) {
      console.error('Error fetching notes:', err)
    }
  }

  const scrollToBottom = useCallback(() => {
    setTimeout(() => notesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  const handleAddNote = async () => {
    if (!task || !newNote.trim()) return
    setAddingNote(true)

    const content = newNote.trim()
    setNewNote('')

    try {
      const res = await fetch(`${apiBase}/${task.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        // Re-fetch to get author info from the server
        await fetchNotes(task.id)
        scrollToBottom()
      }
    } catch (err) {
      console.error('Error adding note:', err)
      setNewNote(content) // restore on failure
    } finally {
      setAddingNote(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const description = editorRef.current?.getContent() || ''

      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('description', description)
      formData.append('priority', priority)
      formData.append('stageId', String(stageId))
      if (showAssignee) {
        formData.append('assignedTo', assignedTo)
      }
      if (showBrandSelector) {
        formData.append('companyId', companyId)
      }

      for (const file of newFiles) {
        formData.append('files', file)
      }

      const url = task
        ? `${apiBase}/${task.id}`
        : apiBase
      const method = task ? 'PUT' : 'POST'

      const res = await fetch(url, { method, body: formData })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save task')
      }

      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFile = async (fileId: number) => {
    if (!task) return
    try {
      const res = await fetch(`${apiBase}/${task.id}/files/${fileId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setExistingFiles((prev) => prev.filter((f) => f.id !== fileId))
      }
    } catch (err) {
      console.error('Error deleting file:', err)
    }
  }

  const handleDeleteTask = async () => {
    if (!task) return
    try {
      const res = await fetch(`${apiBase}/${task.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        onSaved()
        onOpenChange(false)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete task')
      }
    } catch (err) {
      console.error('Error deleting task:', err)
    } finally {
      setShowDelete(false)
    }
  }

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const getUserLabel = (u: EditorialUser) => {
    if (u.firstName || u.lastName) {
      return `${u.firstName || ''} ${u.lastName || ''}`.trim()
    }
    return u.email
  }

  const getNoteName = (note: TaskNote) => {
    if (note.authorFirstName || note.authorLastName) {
      return `${note.authorFirstName || ''} ${note.authorLastName || ''}`.trim()
    }
    return note.authorEmail || 'Unknown'
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{task ? 'Edit Task' : 'New Task'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="task-title">Title *</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <div className="border rounded-lg overflow-hidden">
                <Editor
                  apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || 'no-api-key'}
                  onInit={(_evt, editor) => (editorRef.current = editor)}
                  initialValue={task?.description || ''}
                  init={{
                    height: 200,
                    menubar: false,
                    plugins: [
                      'advlist', 'autolink', 'lists', 'link',
                      'searchreplace', 'visualblocks',
                      'insertdatetime', 'help', 'wordcount',
                    ],
                    toolbar:
                      'undo redo | blocks | bold italic | bullist numlist | link | removeformat',
                    content_style:
                      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.6; }',
                    branding: false,
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  id="task-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Stage */}
              <div className="space-y-2">
                <Label htmlFor="task-stage">Stage</Label>
                <Select
                  id="task-stage"
                  value={String(stageId)}
                  onChange={(e) => setStageId(parseInt(e.target.value))}
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Assigned To */}
              {showAssignee && (
                <div className="space-y-2">
                  <Label htmlFor="task-assignee">Assign To</Label>
                  <Select
                    id="task-assignee"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {getUserLabel(u)}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {/* Brand */}
              {showBrandSelector && companies.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="task-brand">Brand</Label>
                  <Select
                    id="task-brand"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                  >
                    <option value="">No Brand</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            {/* Files */}
            <div className="space-y-2">
              <Label>Files</Label>

              {/* Existing files */}
              {existingFiles.length > 0 && (
                <div className="space-y-2">
                  {existingFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg text-sm"
                    >
                      <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-cyan-700 hover:underline truncate"
                      >
                        {file.filename}
                      </a>
                      <span className="text-gray-400 text-xs flex-shrink-0">
                        {formatFileSize(file.filesize)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(file.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* New files preview */}
              {newFiles.length > 0 && (
                <div className="space-y-2">
                  {newFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg text-sm"
                    >
                      <Upload className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-gray-400 text-xs flex-shrink-0">
                        {formatFileSize(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeNewFile(i)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    setNewFiles((prev) => [...prev, ...Array.from(e.target.files!)])
                  }
                  e.target.value = ''
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Add Files
              </Button>
            </div>

            {/* Notes section — only shown when editing an existing task */}
            {task && (
              <div className="space-y-3 border-t pt-4">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Notes ({notes.length})
                </Label>

                {/* Existing notes */}
                {notes.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {notes.map((note) => (
                      <div key={note.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-700">{getNoteName(note)}</span>
                          <span className="text-xs text-gray-400">{formatDate(note.createdAt)}</span>
                        </div>
                        <p className="text-gray-600 whitespace-pre-wrap">{note.content}</p>
                      </div>
                    ))}
                    <div ref={notesEndRef} />
                  </div>
                )}

                {/* Add note */}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add a note or status update..."
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
            )}

            <DialogFooter className="flex items-center gap-2">
              {task && isCreator && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowDelete(true)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : task ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this task and all its files. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
