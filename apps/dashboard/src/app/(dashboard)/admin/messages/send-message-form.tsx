'use client'

import { useState, useRef, useEffect } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import { setupSchemaPlugin } from '@/lib/tinymce-schema-plugin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface UserSearchResult {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
}

interface EditingMessage {
  id: number
  subject: string
  body: string
  recipientEmail: string
  recipientFirstName: string | null
  recipientLastName: string | null
}

interface SendMessageFormProps {
  preselectedUser?: { id: number; email: string; name?: string }
  editingMessage?: EditingMessage | null
  onSuccess: () => void
  onCancel: () => void
}

export function SendMessageForm({ preselectedUser, editingMessage, onSuccess, onCancel }: SendMessageFormProps) {
  const editorRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subject, setSubject] = useState(editingMessage?.subject || '')

  // User search
  const [searchQuery, setSearchQuery] = useState(preselectedUser?.email || '')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(
    preselectedUser
      ? { id: preselectedUser.id, email: preselectedUser.email, firstName: preselectedUser.name?.split(' ')[0] || null, lastName: preselectedUser.name?.split(' ').slice(1).join(' ') || null }
      : null
  )
  const [showResults, setShowResults] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (preselectedUser || !searchQuery.trim() || searchQuery.length < 2) {
      if (!preselectedUser) setSearchResults([])
      return
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data)
          setShowResults(true)
        }
      } catch {
        // Silently fail
      }
    }, 300)

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [searchQuery, preselectedUser])

  const selectUser = (user: UserSearchResult) => {
    setSelectedUser(user)
    setSearchQuery(user.email)
    setShowResults(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMessage && !selectedUser) {
      setError('Please select a recipient')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const body = editorRef.current?.getContent() || ''

      if (!subject.trim() || !body.trim()) {
        setError('Subject and body are required')
        setIsLoading(false)
        return
      }

      if (editingMessage) {
        // Update existing message
        const response = await fetch(`/api/admin/messages/${editingMessage.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'sent',
            subject: subject.trim(),
            body,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to update message')
        }
      } else {
        // Create new message
        const response = await fetch('/api/admin/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toId: selectedUser!.id,
            subject: subject.trim(),
            body,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to send message')
        }
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

      {editingMessage ? (
        <div className="space-y-2">
          <Label>Recipient</Label>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {editingMessage.recipientEmail}
            {editingMessage.recipientFirstName && ` (${editingMessage.recipientFirstName} ${editingMessage.recipientLastName || ''})`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient *</Label>
          <div className="relative">
            <Input
              id="recipient"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSelectedUser(null)
              }}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              placeholder="Search by email..."
              disabled={!!preselectedUser}
            />
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 text-sm cursor-pointer"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectUser(user)}
                  >
                    <span className="font-medium">{user.email}</span>
                    {user.firstName && (
                      <span className="text-gray-500 dark:text-gray-400 ml-2">
                        ({user.firstName} {user.lastName || ''})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedUser && !preselectedUser && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Sending to: {selectedUser.email}
              {selectedUser.firstName && ` (${selectedUser.firstName} ${selectedUser.lastName || ''})`}
            </p>
          )}
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
            initialValue={editingMessage?.body || ''}
            init={{
              height: 250,
              menubar: false,
              plugins: [
                'advlist', 'autolink', 'lists', 'link',
                'searchreplace', 'visualblocks',
                'insertdatetime', 'help', 'wordcount'
              ],
              toolbar: 'undo redo | blocks | bold italic | bullist numlist | link schemaAttrs | removeformat',
              setup: (editor: any) => { setupSchemaPlugin(editor); },
              extended_valid_elements: '@[itemscope|itemtype|itemid|itemprop|content],a[href|target|rel|itemscope|itemtype|itemprop|class],div[*],span[*],time[datetime|*]',
              link_rel_list: [
                { title: 'None', value: '' },
                { title: 'No Follow', value: 'nofollow' },
                { title: 'Sponsored', value: 'sponsored' },
                { title: 'UGC', value: 'ugc' },
                { title: 'No Follow + Sponsored', value: 'nofollow sponsored' },
              ],
              content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.6; }',
              branding: false,
            }}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-cyan-800 dark:bg-cyan-600 hover:bg-cyan-900 dark:hover:bg-cyan-700 text-white">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {editingMessage ? 'Saving...' : 'Sending...'}
            </>
          ) : (
            editingMessage ? 'Save Changes' : 'Send Message'
          )}
        </Button>
      </div>
    </form>
  )
}
