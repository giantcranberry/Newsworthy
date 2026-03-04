'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'

interface Board {
  id: number
  name: string
  slug: string
  description: string | null
  iconClass: string | null
  color: string
  rules: string | null
  staffOnly: boolean
  isArchived: boolean
}

interface BoardFormProps {
  board?: Board | null
  onSave: () => void
  onCancel: () => void
}

export function BoardForm({ board, onSave, onCancel }: BoardFormProps) {
  const [name, setName] = useState(board?.name || '')
  const [slug, setSlug] = useState(board?.slug || '')
  const [description, setDescription] = useState(board?.description || '')
  const [iconClass, setIconClass] = useState(board?.iconClass || 'fa-light fa-message')
  const [color, setColor] = useState(board?.color || '#3b82f6')
  const [rules, setRules] = useState(board?.rules || '')
  const [staffOnly, setStaffOnly] = useState(board?.staffOnly || false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (!board) {
      setSlug(generateSlug(value))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return

    setSaving(true)
    setError('')

    try {
      const url = board
        ? `/api/admin/community/boards/${board.id}`
        : '/api/admin/community/boards'

      const res = await fetch(url, {
        method: board ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          iconClass: iconClass.trim() || null,
          color,
          rules: rules.trim() || null,
          staffOnly,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save board')
        return
      }

      onSave()
    } catch {
      setError('Failed to save board')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:text-red-400">{error}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. General Discussion"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="e.g. general-discussion"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this board about?"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="iconClass">Icon Class</Label>
          <Input
            id="iconClass"
            value={iconClass}
            onChange={(e) => setIconClass(e.target.value)}
            placeholder="fa-light fa-message"
          />
          {iconClass && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <i className={iconClass} /> Preview
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              id="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-gray-300 dark:border-gray-700"
            />
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rules">Board Rules (Markdown)</Label>
        <Textarea
          id="rules"
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          placeholder="Board-specific rules..."
          rows={4}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <div>
          <Label htmlFor="staffOnly" className="text-sm font-medium">Staff Only Posting</Label>
          <p className="text-xs text-gray-500 dark:text-gray-400">Only Newsworthy team can create posts</p>
        </div>
        <Switch
          id="staffOnly"
          checked={staffOnly}
          onCheckedChange={setStaffOnly}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700">
          {saving ? 'Saving...' : board ? 'Update Board' : 'Create Board'}
        </Button>
      </div>
    </form>
  )
}
