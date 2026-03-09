'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface ActAsButtonProps {
  userId: number
  userEmail: string
}

export function ActAsButton({ userId, userEmail }: ActAsButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleActAs = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to act as user')
      }

      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Act as error:', error)
      alert(error instanceof Error ? error.message : 'Failed to act as user')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="text-sm text-amber-700 dark:text-amber-400 hover:underline cursor-pointer">
          Act As
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Act As User</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to act as <strong>{userEmail}</strong>. You will see the application as this user would see it.
            <br /><br />
            A banner will be displayed at the top of the page. Click &quot;Stop Impersonating&quot; to return to your account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleActAs}
            disabled={isLoading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Continue'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
