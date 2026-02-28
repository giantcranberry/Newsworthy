'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Globe, Mail, Plus, Send, Pencil, XCircle, Trash2, Loader2 } from 'lucide-react'
import { GlobalMessageForm } from './global-message-form'
import { SendMessageForm } from './send-message-form'

interface GlobalMessage {
  id: number
  subject: string
  body: string
  isActive: boolean
  expiresAt: string | null
  createdAt: string
}

interface SentMessage {
  id: number
  subject: string
  body: string
  isRead: boolean
  emailSent: boolean
  createdAt: string
  recipientEmail: string
  recipientFirstName: string | null
  recipientLastName: string | null
}

export function MessagesAdmin() {
  const [globals, setGlobals] = useState<GlobalMessage[]>([])
  const [sent, setSent] = useState<SentMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [globalDialogOpen, setGlobalDialogOpen] = useState(false)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [editingMessage, setEditingMessage] = useState<GlobalMessage | null>(null)
  const [editingSentMessage, setEditingSentMessage] = useState<SentMessage | null>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/messages')
      if (res.ok) {
        const data = await res.json()
        setGlobals(data.globals)
        setSent(data.sent)
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const handleDeactivate = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/messages/${id}`, { method: 'DELETE' })
      if (res.ok) fetchMessages()
    } catch (err) {
      console.error('Failed to deactivate message:', err)
    }
  }

  const handleDeleteGlobal = async (id: number) => {
    if (!confirm('Permanently delete this global message? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/admin/messages/${id}?type=global`, { method: 'DELETE' })
      if (res.ok) fetchMessages()
    } catch (err) {
      console.error('Failed to delete global message:', err)
    }
  }

  const handleDeleteSent = async (id: number) => {
    if (!confirm('Permanently delete this sent message? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/admin/messages/${id}?type=sent`, { method: 'DELETE' })
      if (res.ok) fetchMessages()
    } catch (err) {
      console.error('Failed to delete sent message:', err)
    }
  }

  const handleReactivate = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/messages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
      if (res.ok) fetchMessages()
    } catch (err) {
      console.error('Failed to reactivate message:', err)
    }
  }

  const getStatusBadge = (msg: GlobalMessage) => {
    if (!msg.isActive) {
      return <Badge className="bg-gray-100 text-gray-700">Inactive</Badge>
    }
    if (msg.expiresAt && new Date(msg.expiresAt) < new Date()) {
      return <Badge className="bg-amber-100 text-amber-700">Expired</Badge>
    }
    return <Badge className="bg-green-100 text-green-700">Active</Badge>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <>
      <Tabs defaultValue="global">
        <TabsList>
          <TabsTrigger value="global" className="gap-2">
            <Globe className="h-4 w-4" />
            Global Messages
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-2">
            <Send className="h-4 w-4" />
            Sent Messages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => { setEditingMessage(null); setGlobalDialogOpen(true) }}
              className="gap-2 bg-cyan-800 hover:bg-cyan-900 text-white"
            >
              <Plus className="h-4 w-4" />
              Create Global Message
            </Button>
          </div>

          {globals.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                No global messages yet. Create one to broadcast to all users.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {globals.map((msg) => (
                <Card key={msg.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(msg)}
                          <h3 className="font-medium text-gray-900 truncate">{msg.subject}</h3>
                        </div>
                        <p className="text-xs text-gray-500">
                          Created {new Date(msg.createdAt).toLocaleDateString()}
                          {msg.expiresAt && (
                            <> &middot; Expires {new Date(msg.expiresAt).toLocaleDateString()}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setEditingMessage(msg); setGlobalDialogOpen(true) }}
                          className="gap-1"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                        {msg.isActive ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeactivate(msg.id)}
                            className="gap-1 text-red-600 hover:text-red-700"
                          >
                            <XCircle className="h-3 w-3" />
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReactivate(msg.id)}
                            className="gap-1 text-green-600 hover:text-green-700"
                          >
                            Reactivate
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteGlobal(msg.id)}
                          className="gap-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sent" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => { setEditingSentMessage(null); setSendDialogOpen(true) }}
              className="gap-2 bg-cyan-800 hover:bg-cyan-900 text-white"
            >
              <Mail className="h-4 w-4" />
              Send Message
            </Button>
          </div>

          {sent.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                No individual messages sent yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sent.map((msg) => (
                <Card key={msg.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900 truncate">{msg.subject}</h3>
                        <p className="text-sm text-gray-600">
                          To: {msg.recipientEmail}
                          {msg.recipientFirstName && ` (${msg.recipientFirstName} ${msg.recipientLastName || ''})`}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {new Date(msg.createdAt).toLocaleDateString()}
                          </span>
                          {msg.isRead ? (
                            <Badge className="bg-green-100 text-green-700 text-xs">Read</Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-700 text-xs">Unread</Badge>
                          )}
                          {msg.emailSent && (
                            <Badge className="bg-purple-100 text-purple-700 text-xs">Email Sent</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!msg.isRead && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setEditingSentMessage(msg); setSendDialogOpen(true) }}
                            className="gap-1"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteSent(msg.id)}
                          className="gap-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Global Message Dialog */}
      <Dialog open={globalDialogOpen} onOpenChange={setGlobalDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMessage ? 'Edit Global Message' : 'Create Global Message'}</DialogTitle>
          </DialogHeader>
          <GlobalMessageForm
            message={editingMessage}
            onSuccess={() => { setGlobalDialogOpen(false); fetchMessages() }}
            onCancel={() => setGlobalDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Send / Edit Message Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={(open) => { setSendDialogOpen(open); if (!open) setEditingSentMessage(null) }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSentMessage ? 'Edit Message' : 'Send Message'}</DialogTitle>
          </DialogHeader>
          <SendMessageForm
            key={editingSentMessage?.id || 'new'}
            editingMessage={editingSentMessage}
            onSuccess={() => { setSendDialogOpen(false); setEditingSentMessage(null); fetchMessages() }}
            onCancel={() => { setSendDialogOpen(false); setEditingSentMessage(null) }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
