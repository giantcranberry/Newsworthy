'use client'

import { useState, useRef } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'

interface GlobalMessage {
  id: number
  subject: string
  body: string
  isActive: boolean
  expiresAt: string | null
  createdAt: string
}

interface GlobalMessageFormProps {
  message: GlobalMessage | null
  onSuccess: () => void
  onCancel: () => void
}

export function GlobalMessageForm({ message, onSuccess, onCancel }: GlobalMessageFormProps) {
  const editorRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subject, setSubject] = useState(message?.subject || '')
  const [expiresAt, setExpiresAt] = useState(
    message?.expiresAt ? new Date(message.expiresAt).toISOString().slice(0, 16) : ''
  )
  const [isActive, setIsActive] = useState(message?.isActive ?? true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const body = editorRef.current?.getContent() || ''

      if (!subject.trim() || !body.trim()) {
        setError('Subject and body are required')
        setIsLoading(false)
        return
      }

      const url = message
        ? `/api/admin/messages/${message.id}`
        : '/api/admin/messages'

      const response = await fetch(url, {
        method: message ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          body,
          expiresAt: expiresAt || null,
          ...(message ? { isActive } : {}),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save message')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="subject">Subject *</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Message subject"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Body *</Label>
        <div className="border rounded-lg overflow-hidden">
          <Editor
            apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || 'no-api-key'}
            onInit={(evt, editor) => (editorRef.current = editor)}
            initialValue={message?.body || ''}
            init={{
              height: 300,
              menubar: false,
              plugins: [
                'advlist', 'autolink', 'lists', 'link',
                'searchreplace', 'visualblocks',
                'insertdatetime', 'help', 'wordcount'
              ],
              toolbar: 'undo redo | blocks | bold italic | bullist numlist | link | removeformat',
              content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.6; }',
              branding: false,
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="expiresAt">Expires At (optional)</Label>
        <Input
          id="expiresAt"
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">Leave empty for no expiration</p>
      </div>

      {message && (
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
          <div>
            <Label htmlFor="isActive" className="font-medium">Active</Label>
            <p className="text-sm text-gray-500 dark:text-gray-400">Inactive messages are hidden from all users</p>
          </div>
          <Switch
            id="isActive"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-cyan-800 dark:bg-cyan-600 hover:bg-cyan-900 dark:hover:bg-cyan-700 text-white">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            message ? 'Update Message' : 'Create Message'
          )}
        </Button>
      </div>
    </form>
  )
}
