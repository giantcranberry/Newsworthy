'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2, Loader2 } from 'lucide-react'

interface DeleteUserButtonProps {
  userId: number
  userEmail: string
  userName?: string
}

export function DeleteUserButton({ userId, userEmail, userName }: DeleteUserButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  const emailMatches = confirmEmail.trim().toLowerCase() === userEmail.toLowerCase()

  const handleDelete = async () => {
    if (!emailMatches || isDeleting) return
    setIsDeleting(true)
    setError('')

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmPermanent: true,
          confirmEmail: confirmEmail.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to permanently delete user')
        setIsDeleting(false)
        return
      }
      router.push('/admin/users')
      router.refresh()
    } catch {
      setError('Failed to permanently delete user')
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (isDeleting) return
        setOpen(next)
        if (!next) {
          setConfirmEmail('')
          setError('')
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          Permanently delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently delete this user?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                This is a <strong className="text-red-600 dark:text-red-400">permanent delete</strong>, not a
                soft delete. It cannot be undone.
              </p>
              <p>
                This will hard-delete {userName ? <strong>{userName}</strong> : 'this user'} ({userEmail})
                and clean up related records, including:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Owned brand / company profiles</li>
                <li>Press releases and category / region assignments</li>
                <li>Credits, contacts, assets, CRM, and user account rows</li>
              </ul>
              <div className="space-y-2 pt-1">
                <Label htmlFor="confirm-delete-email">
                  Type the user&apos;s email to confirm
                </Label>
                <Input
                  id="confirm-delete-email"
                  type="email"
                  autoComplete="off"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={userEmail}
                  disabled={isDeleting}
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!emailMatches || isDeleting}
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting…
              </>
            ) : (
              'Permanently delete'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
