'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Mail, Send, Loader2, Trash2, Settings2, MessageSquarePlus } from 'lucide-react'

interface CannedMessage {
  id: number
  handle: string
  subject: string | null
  msg: string
}

interface QuickMessageProps {
  userId: number
  userName: string
  userEmail: string
  releaseTitle: string | null
}

export function QuickMessage({ userId, userName, userEmail, releaseTitle }: QuickMessageProps) {
  const [cannedMessages, setCannedMessages] = useState<CannedMessage[]>([])
  const [selectedCannedId, setSelectedCannedId] = useState<string>('')
  const [inlineSubject, setInlineSubject] = useState('')
  const [inlineBody, setInlineBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Custom message dialog
  const [customOpen, setCustomOpen] = useState(false)
  const [customSubject, setCustomSubject] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [saveAsCanned, setSaveAsCanned] = useState(false)
  const [cannedLabel, setCannedLabel] = useState('')
  const [customSending, setCustomSending] = useState(false)

  // Manage dialog
  const [manageOpen, setManageOpen] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const defaultSubject = `Regarding your press release: "${releaseTitle || 'Untitled'}"`

  const fetchCanned = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/canned-messages')
      if (res.ok) {
        const data = await res.json()
        setCannedMessages(data)
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchCanned()
  }, [fetchCanned])

  const handleCannedSelect = (value: string) => {
    setSelectedCannedId(value)
    setSendResult(null)
    const msg = cannedMessages.find(m => String(m.id) === value)
    if (msg) {
      setInlineSubject(msg.subject || defaultSubject)
      setInlineBody(msg.msg)
    }
  }

  const handleInlineSend = async () => {
    if (!inlineSubject.trim() || !inlineBody.trim()) return
    setSending(true)
    setSendResult(null)

    try {
      const res = await fetch('/api/admin/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toId: userId,
          subject: inlineSubject.trim(),
          body: inlineBody.trim(),
        }),
      })

      if (res.ok) {
        setSendResult({ type: 'success', text: `Message sent to ${userEmail}` })
        setSelectedCannedId('')
        setInlineSubject('')
        setInlineBody('')
      } else {
        const data = await res.json()
        setSendResult({ type: 'error', text: data.error || 'Failed to send' })
      }
    } catch {
      setSendResult({ type: 'error', text: 'Failed to send message' })
    } finally {
      setSending(false)
    }
  }

  const openCustomDialog = () => {
    setCustomSubject(defaultSubject)
    setCustomBody('')
    setSaveAsCanned(false)
    setCannedLabel('')
    setCustomOpen(true)
  }

  const handleCustomSend = async () => {
    if (!customSubject.trim() || !customBody.trim()) return
    setCustomSending(true)

    try {
      const res = await fetch('/api/admin/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toId: userId,
          subject: customSubject.trim(),
          body: customBody.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setSendResult({ type: 'error', text: data.error || 'Failed to send' })
        setCustomSending(false)
        return
      }

      // Optionally save as canned
      if (saveAsCanned && cannedLabel.trim()) {
        await fetch('/api/admin/canned-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            handle: cannedLabel.trim(),
            subject: customSubject.trim(),
            msg: customBody.trim(),
          }),
        })
        await fetchCanned()
      }

      setSendResult({ type: 'success', text: `Message sent to ${userEmail}` })
      setCustomOpen(false)
    } catch {
      setSendResult({ type: 'error', text: 'Failed to send message' })
    } finally {
      setCustomSending(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/canned-messages/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCannedMessages(prev => prev.filter(m => m.id !== id))
        if (selectedCannedId === String(id)) {
          setSelectedCannedId('')
          setInlineSubject('')
          setInlineBody('')
        }
      }
    } catch {
      // silent
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <div className="rounded-lg border border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-teal-950 p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Mail className="h-4 w-4 text-teal-700 dark:text-teal-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-teal-900 dark:text-teal-100">Quick Message to {userName}</p>
            <p className="text-xs text-teal-700 dark:text-teal-400 mt-0.5">{userEmail}</p>

            <div className="mt-3 space-y-2">
              {/* Canned message selector */}
              <div className="flex items-center gap-2">
                <SelectRoot value={selectedCannedId} onValueChange={handleCannedSelect}>
                  <SelectTrigger className="flex-1 h-8 text-xs bg-white dark:bg-gray-900">
                    <SelectValue placeholder="Select a saved message..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cannedMessages.map(msg => (
                      <SelectItem key={msg.id} value={String(msg.id)}>
                        {msg.handle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
                {cannedMessages.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() => setManageOpen(true)}
                  >
                    <Settings2 className="h-3 w-3" />
                    Manage
                  </Button>
                )}
              </div>

              {/* Subject field + body preview (shown when a canned message is selected) */}
              {selectedCannedId && (
                <>
                  <Input
                    value={inlineSubject}
                    onChange={e => setInlineSubject(e.target.value)}
                    className="h-8 text-xs bg-white dark:bg-gray-900"
                    placeholder="Subject"
                  />
                  <p className="text-xs text-teal-700 dark:text-teal-400 bg-white dark:bg-gray-900 rounded border border-teal-100 dark:border-teal-900 p-2 whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {inlineBody}
                  </p>
                </>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {selectedCannedId && (
                  <Button
                    size="sm"
                    className="h-8 bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-xs gap-1"
                    disabled={sending || !inlineSubject.trim() || !inlineBody.trim()}
                    onClick={handleInlineSend}
                  >
                    {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    {sending ? 'Sending...' : 'Send'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={openCustomDialog}
                >
                  <MessageSquarePlus className="h-3 w-3" />
                  Custom message
                </Button>
              </div>

              {/* Result feedback */}
              {sendResult && (
                <p className={`text-xs font-medium ${sendResult.type === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {sendResult.text}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Message Dialog */}
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Message to {userName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-subject">Subject</Label>
              <Input
                id="custom-subject"
                value={customSubject}
                onChange={e => setCustomSubject(e.target.value)}
                placeholder="Message subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-body">Message</Label>
              <Textarea
                id="custom-body"
                value={customBody}
                onChange={e => setCustomBody(e.target.value)}
                placeholder="Type your message..."
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="save-canned"
                  checked={saveAsCanned}
                  onCheckedChange={(checked) => setSaveAsCanned(checked === true)}
                />
                <Label htmlFor="save-canned" className="text-sm font-normal cursor-pointer">
                  Save as canned message for future use
                </Label>
              </div>
              {saveAsCanned && (
                <Input
                  value={cannedLabel}
                  onChange={e => setCannedLabel(e.target.value)}
                  placeholder="Label (e.g. 'Missing contact info')"
                  className="mt-2"
                />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="outline" onClick={() => setCustomOpen(false)} disabled={customSending}>
                Cancel
              </Button>
              <Button
                onClick={handleCustomSend}
                disabled={customSending || !customSubject.trim() || !customBody.trim() || (saveAsCanned && !cannedLabel.trim())}
                className="bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700"
              >
                {customSending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="h-4 w-4" /> Send Message</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Canned Messages Dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Saved Messages</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {cannedMessages.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No saved messages yet</p>
            ) : (
              cannedMessages.map(msg => (
                <div key={msg.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-white dark:bg-gray-900">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{msg.handle}</p>
                    {msg.subject && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{msg.subject}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    disabled={deleting === msg.id}
                    onClick={() => handleDelete(msg.id)}
                  >
                    {deleting === msg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
