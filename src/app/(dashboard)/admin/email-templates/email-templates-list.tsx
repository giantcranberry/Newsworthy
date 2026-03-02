'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft, Search, Mail, Eye } from 'lucide-react'

interface EmailTemplate {
  id: number
  slug: string
  name: string
  subject: string
  htmlBody: string
  textBody: string | null
  description: string | null
  variables: string | null
  updatedAt: Date | null
  createdAt: Date | null
}

export function EmailTemplatesList({ templates: initialTemplates }: { templates: EmailTemplate[] }) {
  const [templates] = useState(initialTemplates)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [previewMode, setPreviewMode] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editHtmlBody, setEditHtmlBody] = useState('')
  const [editTextBody, setEditTextBody] = useState('')
  const [editDescription, setEditDescription] = useState('')

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase())
  )

  const startEditing = (template: EmailTemplate) => {
    setEditing(template)
    setEditName(template.name)
    setEditSubject(template.subject)
    setEditHtmlBody(template.htmlBody)
    setEditTextBody(template.textBody || '')
    setEditDescription(template.description || '')
    setError('')
    setSuccess('')
    setPreviewMode(false)
  }

  const cancelEditing = () => {
    setEditing(null)
    setError('')
    setSuccess('')
    setPreviewMode(false)
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/admin/email-templates/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          subject: editSubject,
          htmlBody: editHtmlBody,
          textBody: editTextBody,
          description: editDescription,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save template')
      }

      const updated = await response.json()
      // Update in local list
      const idx = templates.findIndex((t) => t.id === editing.id)
      if (idx >= 0) {
        templates[idx] = updated
      }
      setEditing(updated)
      setSuccess('Template saved successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Editor view
  if (editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={cancelEditing} className="cursor-pointer">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{editing.name}</h2>
            <p className="text-xs text-gray-500 font-mono">{editing.slug}</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {success}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">Template Name</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-sm font-medium text-gray-700">Email Subject</Label>
              <Input
                id="subject"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-gray-700">Description</Label>
            <Input
              id="description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Brief description of when this email is sent"
              className="h-10"
            />
          </div>

          {editing.variables && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs font-medium text-gray-600 mb-1">Available Variables</p>
              <p className="text-xs text-gray-500 font-mono">{editing.variables}</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">HTML Body</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewMode(!previewMode)}
                className="cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                {previewMode ? 'Edit' : 'Preview'}
              </Button>
            </div>
            {previewMode ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <iframe
                  srcDoc={editHtmlBody}
                  className="w-full h-[500px] border-0"
                  title="Email Preview"
                  sandbox=""
                />
              </div>
            ) : (
              <textarea
                value={editHtmlBody}
                onChange={(e) => setEditHtmlBody(e.target.value)}
                className="w-full h-[500px] font-mono text-sm border border-slate-200 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:border-transparent resize-y"
                spellCheck={false}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Plain Text Body (fallback)</Label>
            <textarea
              value={editTextBody}
              onChange={(e) => setEditTextBody(e.target.value)}
              className="w-full h-40 font-mono text-sm border border-slate-200 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:border-transparent resize-y"
              spellCheck={false}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="outline" onClick={cancelEditing} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-cyan-800 hover:bg-cyan-900 text-white cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Template'
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No templates found.
          </div>
        ) : (
          filtered.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{template.name}</h3>
                  <p className="text-xs text-gray-500 font-mono">{template.slug}</p>
                  {template.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {template.updatedAt && (
                  <span className="text-xs text-gray-400">
                    Updated {new Date(template.updatedAt).toLocaleDateString()}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEditing(template)}
                  className="cursor-pointer"
                >
                  Edit
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
