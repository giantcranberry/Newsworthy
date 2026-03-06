'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SendMessageForm } from '../../messages/send-message-form'

interface SendMessageDialogProps {
  userId: number
  userEmail: string
  userName?: string
}

export function SendMessageDialog({ userId, userEmail, userName }: SendMessageDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Mail className="h-4 w-4" />
        Send Message
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Message to {userName || userEmail}</DialogTitle>
          </DialogHeader>
          <SendMessageForm
            preselectedUser={{ id: userId, email: userEmail, name: userName }}
            onSuccess={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
