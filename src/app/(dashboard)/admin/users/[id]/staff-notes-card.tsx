'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Pencil, Loader2, X, Check } from 'lucide-react'

interface StaffNote {
  id: number
  staffName: string | null
  body: string | null
  createdAt: Date | null
}

export function StaffNotesCard({
  notes: initialNotes,
  userId,
}: {
  notes: StaffNote[]
  userId: number
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [newNote, setNewNote] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const handleAdd = async () => {
    if (newNote.trim().length < 10) return
    setIsAdding(true)
    try {
      const res = await fetch('/api/admin/staff-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, body: newNote }),
      })
      if (res.ok) {
        const note = await res.json()
        setNotes((prev) => [note, ...prev])
        setNewNote('')
      }
    } catch {
      // silently fail
    } finally {
      setIsAdding(false)
    }
  }

  const handleDelete = async (noteId: number) => {
    if (!confirm('Delete this staff note?')) return
    setDeletingId(noteId)
    try {
      const res = await fetch(`/api/admin/staff-notes/${noteId}`, { method: 'DELETE' })
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId))
      }
    } catch {
      // silently fail
    } finally {
      setDeletingId(null)
    }
  }

  const startEdit = (note: StaffNote) => {
    setEditingId(note.id)
    setEditText(note.body || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const handleSaveEdit = async (noteId: number) => {
    if (editText.trim().length < 10) return
    setIsSavingEdit(true)
    try {
      const res = await fetch(`/api/admin/staff-notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editText }),
      })
      if (res.ok) {
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, body: editText.trim() } : n))
        )
        setEditingId(null)
        setEditText('')
      }
    } catch {
      // silently fail
    } finally {
      setIsSavingEdit(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Staff Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add note form */}
        <div className="space-y-2">
          <Textarea
            placeholder="Add a staff note (min 10 characters)..."
            rows={3}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <Button
            onClick={handleAdd}
            disabled={isAdding || newNote.trim().length < 10}
            size="sm"
          >
            {isAdding ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Adding...
              </>
            ) : (
              'Add Note'
            )}
          </Button>
        </div>

        {/* Notes list */}
        {notes.length === 0 ? (
          <p className="text-sm text-gray-500">No staff notes yet</p>
        ) : (
          <div className="space-y-4 text-sm">
            {notes.map((note) => (
              <div key={note.id} className="border-b border-gray-100 pb-3 last:border-0 group">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span className="font-medium text-gray-700">{note.staffName || 'Staff'}</span>
                  <div className="flex items-center gap-2">
                    <span>
                      {note.createdAt ? new Date(note.createdAt).toLocaleString() : 'Just now'}
                    </span>
                    {editingId !== note.id && (
                      <>
                        <button
                          onClick={() => startEdit(note)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 hover:text-blue-600 cursor-pointer"
                          title="Edit note"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(note.id)}
                          disabled={deletingId === note.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 cursor-pointer disabled:opacity-50"
                          title="Delete note"
                        >
                          {deletingId === note.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSaveEdit(note.id)}
                        disabled={isSavingEdit || editText.trim().length < 10}
                        size="sm"
                        variant="outline"
                      >
                        {isSavingEdit ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <Check className="h-3.5 w-3.5 mr-1" />
                        )}
                        Save
                      </Button>
                      <Button onClick={cancelEdit} size="sm" variant="ghost">
                        <X className="h-3.5 w-3.5 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p>{note.body}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
