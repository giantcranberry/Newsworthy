'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Users, UserPlus, Pencil, Trash2, Mail, Clock } from 'lucide-react'

interface TeamMember {
  id: number
  userId: number
  email: string
  name: string
  role: string
  createdAt: string
}

interface TeamInvite {
  id: number
  email: string
  role: string
  createdAt: string
  expiresAt: string
}

interface TeamOwner {
  id: number
  email: string
  name: string
  role: string
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  brand_admin: 'Brand Admin',
  collaborator: 'Collaborator',
  client: 'Client',
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400',
  brand_admin: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400',
  collaborator: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
  client: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
}

export function TeamSection({ companyUuid }: { companyUuid: string }) {
  const [isLoading, setIsLoading] = useState(true)
  const [owner, setOwner] = useState<TeamOwner | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [currentUserRole, setCurrentUserRole] = useState<string>('client')

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('collaborator')
  const [isSendingInvite, setIsSendingInvite] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Edit role modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [editRole, setEditRole] = useState('')
  const [isSavingRole, setIsSavingRole] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Remove modal
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [removingItem, setRemovingItem] = useState<{ id: number; type: 'member' | 'invite'; label: string } | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const canManageTeam = currentUserRole === 'owner' || currentUserRole === 'brand_admin'

  const fetchTeam = async () => {
    try {
      const res = await fetch(`/api/company/${companyUuid}/team`)
      if (!res.ok) return
      const data = await res.json()
      setOwner(data.owner)
      setMembers(data.members)
      setInvites(data.invites)
      setCurrentUserRole(data.currentUserRole)
    } catch (err) {
      console.error('Failed to load team:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTeam()
  }, [companyUuid])

  const handleSendInvite = async () => {
    setIsSendingInvite(true)
    setInviteError(null)

    try {
      const res = await fetch(`/api/company/${companyUuid}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send invitation')
      }

      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('collaborator')
      fetchTeam()
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setIsSendingInvite(false)
    }
  }

  const handleUpdateRole = async () => {
    if (!editingMember) return
    setIsSavingRole(true)
    setEditError(null)

    try {
      const res = await fetch(`/api/company/${companyUuid}/team/${editingMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editRole }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update role')
      }

      setShowEditModal(false)
      setEditingMember(null)
      fetchTeam()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setIsSavingRole(false)
    }
  }

  const handleRemove = async () => {
    if (!removingItem) return
    setIsRemoving(true)
    setRemoveError(null)

    try {
      const url = `/api/company/${companyUuid}/team/${removingItem.id}?type=${removingItem.type}`
      const res = await fetch(url, { method: 'DELETE' })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove')
      }

      setShowRemoveModal(false)
      setRemovingItem(null)
      fetchTeam()
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Failed to remove')
    } finally {
      setIsRemoving(false)
    }
  }

  const openEditRole = (member: TeamMember) => {
    setEditingMember(member)
    setEditRole(member.role)
    setEditError(null)
    setShowEditModal(true)
  }

  const openRemoveMember = (member: TeamMember) => {
    setRemovingItem({ id: member.id, type: 'member', label: member.name || member.email })
    setRemoveError(null)
    setShowRemoveModal(true)
  }

  const openRemoveInvite = (invite: TeamInvite) => {
    setRemovingItem({ id: invite.id, type: 'invite', label: invite.email })
    setRemoveError(null)
    setShowRemoveModal(true)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-400" />
              Team
            </CardTitle>
            {canManageTeam && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setInviteError(null)
                  setInviteEmail('')
                  setInviteRole('collaborator')
                  setShowInviteModal(true)
                }}
              >
                <UserPlus className="h-4 w-4" />
                Invite Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Active Members */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700 text-left">
                  <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Email</th>
                  <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Role</th>
                  {canManageTeam && (
                    <th className="pb-2 font-medium text-gray-500 dark:text-gray-400 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {/* Owner row */}
                {owner && (
                  <tr className="border-b dark:border-gray-700">
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">{owner.name}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{owner.email}</td>
                    <td className="py-2 pr-4">
                      <Badge variant="secondary" className={ROLE_COLORS.owner}>
                        {ROLE_LABELS.owner}
                      </Badge>
                    </td>
                    {canManageTeam && <td />}
                  </tr>
                )}
                {/* Members */}
                {members.map((m) => (
                  <tr key={m.id} className="border-b dark:border-gray-700 last:border-0">
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">{m.name}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{m.email}</td>
                    <td className="py-2 pr-4">
                      <Badge variant="secondary" className={ROLE_COLORS[m.role] || ROLE_COLORS.client}>
                        {ROLE_LABELS[m.role] || m.role}
                      </Badge>
                    </td>
                    {canManageTeam && (
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditRole(m)}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:text-blue-400 transition-colors"
                            title="Change role"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openRemoveMember(m)}
                            className="p-1 text-gray-400 hover:text-red-600 dark:text-red-400 transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {members.length === 0 && !owner && (
            <p className="text-sm text-gray-400 text-center py-4">
              No team members yet. Invite someone to collaborate on this brand.
            </p>
          )}

          {/* Pending Invites */}
          {canManageTeam && invites.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                Pending Invitations
              </h4>
              <div className="space-y-2">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-950 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{inv.email}</span>
                      <Badge variant="secondary" className={ROLE_COLORS[inv.role] || ROLE_COLORS.client}>
                        {ROLE_LABELS[inv.role] || inv.role}
                      </Badge>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openRemoveInvite(inv)}
                      className="text-sm text-gray-400 hover:text-red-600 dark:text-red-400 transition-colors"
                      title="Cancel invitation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to collaborate on this brand.
            </DialogDescription>
          </DialogHeader>

          {inviteError && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 p-3 rounded-lg">{inviteError}</div>
          )}

          <div className="grid gap-4 py-2">
            <div>
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="invite-role">Role</Label>
              <Select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="mt-1"
              >
                <option value="brand_admin">Brand Admin — Full brand management</option>
                <option value="collaborator">Collaborator — Edit access</option>
                <option value="client">Client — Read-only access</option>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendInvite}
              disabled={isSendingInvite || !inviteEmail.trim()}
              className="gap-2 bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
            >
              {isSendingInvite ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Update the role for {editingMember?.name || editingMember?.email}.
            </DialogDescription>
          </DialogHeader>

          {editError && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 p-3 rounded-lg">{editError}</div>
          )}

          <div className="py-2">
            <Label htmlFor="edit-role">Role</Label>
            <Select
              id="edit-role"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="mt-1"
            >
              <option value="brand_admin">Brand Admin</option>
              <option value="collaborator">Collaborator</option>
              <option value="client">Client</option>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdateRole} disabled={isSavingRole}>
              {isSavingRole ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Modal */}
      <Dialog open={showRemoveModal} onOpenChange={setShowRemoveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {removingItem?.type === 'invite' ? 'Cancel Invitation' : 'Remove Member'}
            </DialogTitle>
            <DialogDescription>
              {removingItem?.type === 'invite'
                ? `Cancel the invitation sent to ${removingItem?.label}?`
                : `Remove ${removingItem?.label} from this team?`}
            </DialogDescription>
          </DialogHeader>

          {removeError && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 p-3 rounded-lg">{removeError}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowRemoveModal(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleRemove} disabled={isRemoving}>
              {isRemoving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {removingItem?.type === 'invite' ? 'Cancel Invitation' : 'Remove Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
