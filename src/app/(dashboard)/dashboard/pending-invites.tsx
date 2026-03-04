'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, UserPlus, Building2 } from 'lucide-react'

interface Invite {
  id: number
  token: string
  role: string
  companyName: string
  companyLogo: string | null
}

const ROLE_LABELS: Record<string, string> = {
  brand_admin: 'Brand Admin',
  collaborator: 'Collaborator',
  client: 'Client',
}

const ROLE_COLORS: Record<string, string> = {
  brand_admin: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400',
  collaborator: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
  client: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
}

export function PendingInvites({ invites: initialInvites }: { invites: Invite[] }) {
  const router = useRouter()
  const [invites, setInvites] = useState(initialInvites)
  const [acceptingId, setAcceptingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAccept = async (invite: Invite) => {
    setAcceptingId(invite.id)
    setError(null)

    try {
      const res = await fetch('/api/company/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: invite.token }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to accept invitation')
      }

      setInvites(prev => prev.filter(i => i.id !== invite.id))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setAcceptingId(null)
    }
  }

  if (invites.length === 0) return null

  return (
    <Card className="border-cyan-200 bg-cyan-50 dark:bg-cyan-900/30/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="h-5 w-5 text-cyan-700" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {invites.length === 1 ? 'You have a team invitation' : `You have ${invites.length} team invitations`}
          </h3>
        </div>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 p-2 rounded mb-3">{error}</div>
        )}

        <div className="space-y-2">
          {invites.map(invite => (
            <div key={invite.id} className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
              <div className="flex items-center gap-3">
                {invite.companyLogo ? (
                  <img src={invite.companyLogo} alt={invite.companyName} className="h-8 w-8 rounded object-contain" />
                ) : (
                  <div className="h-8 w-8 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{invite.companyName}</p>
                  <Badge variant="secondary" className={ROLE_COLORS[invite.role] || ROLE_COLORS.client}>
                    {ROLE_LABELS[invite.role] || invite.role}
                  </Badge>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleAccept(invite)}
                disabled={acceptingId === invite.id}
                className="gap-1.5 bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer"
              >
                {acceptingId === invite.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                Accept
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
