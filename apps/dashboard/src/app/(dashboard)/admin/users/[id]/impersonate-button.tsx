'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { UserCog, Loader2 } from 'lucide-react'
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

interface ImpersonateButtonProps {
  userId: number
  userEmail: string
}

export function ImpersonateButton({ userId, userEmail }: ImpersonateButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleImpersonate = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to impersonate user')
      }

      // Redirect to dashboard as the impersonated user
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Impersonation error:', error)
      alert(error instanceof Error ? error.message : 'Failed to impersonate user')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50">
          <UserCog className="h-4 w-4 mr-2" />
          Impersonate
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Impersonate User</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to impersonate <strong>{userEmail}</strong>. You will see the application as this user would see it.
            <br /><br />
            A banner will be displayed at the top of the page while impersonating. Click &quot;Stop Impersonating&quot; to return to your admin account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleImpersonate}
            disabled={isLoading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Impersonating...
              </>
            ) : (
              'Start Impersonation'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
