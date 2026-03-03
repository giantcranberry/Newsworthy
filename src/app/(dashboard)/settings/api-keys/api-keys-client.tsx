'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Key, Plus, Trash2, Copy, Check, AlertTriangle } from 'lucide-react'

interface ApiKey {
  uuid: string
  name: string
  keyPrefix: string
  companyName: string | null
  companyUuid: string
  isActive: boolean | null
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string | null
}

interface Company {
  uuid: string
  companyName: string
}

interface Props {
  initialKeys: ApiKey[]
  companies: Company[]
}

export function ApiKeysClient({ initialKeys, companies }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys)
  const [showCreate, setShowCreate] = useState(false)
  const [showRevoke, setShowRevoke] = useState<string | null>(null)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [copied, setCopied] = useState(false)

  // Create form state
  const [keyName, setKeyName] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  async function handleCreate() {
    if (!keyName.trim() || !selectedCompany) return

    setCreating(true)
    setCreateError(null)

    try {
      const res = await fetch('/api/a2a/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName.trim(), companyUuid: selectedCompany }),
      })

      const data = await res.json()

      if (!res.ok) {
        setCreateError(data.error || 'Failed to create key')
        return
      }

      setNewKey(data.apiKey)
      setKeys(prev => [...prev, data.key])
      setKeyName('')
      setSelectedCompany('')
    } catch {
      setCreateError('Failed to create key')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(uuid: string) {
    setRevoking(true)
    try {
      const res = await fetch(`/api/a2a/keys?uuid=${uuid}`, { method: 'DELETE' })
      if (res.ok) {
        setKeys(prev => prev.map(k => k.uuid === uuid ? { ...k, isActive: false } : k))
      }
    } catch {
      // Silently fail
    } finally {
      setRevoking(false)
      setShowRevoke(null)
    }
  }

  function handleCopy() {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleCloseCreate() {
    setShowCreate(false)
    setNewKey(null)
    setKeyName('')
    setSelectedCompany('')
    setCreateError(null)
    setCopied(false)
  }

  const activeKeys = keys.filter(k => k.isActive)
  const revokedKeys = keys.filter(k => !k.isActive)

  return (
    <>
      {/* Create Button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)} disabled={companies.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      </div>

      {companies.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <p>You need at least one brand to create API keys.</p>
          </CardContent>
        </Card>
      )}

      {/* Active Keys */}
      {activeKeys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Keys</CardTitle>
            <CardDescription>API keys currently in use</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeKeys.map(key => (
                <div
                  key={key.uuid}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center">
                      <Key className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{key.name}</span>
                        <Badge variant="secondary" className="text-xs">{key.companyName}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded">{key.keyPrefix}...</code>
                        <span>Created {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}</span>
                        {key.lastUsedAt && (
                          <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                        )}
                        {key.expiresAt && (
                          <span>Expires {new Date(key.expiresAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setShowRevoke(key.uuid)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeKeys.length === 0 && companies.length > 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <Key className="h-8 w-8 mx-auto mb-3 text-gray-300" />
            <p>No API keys yet. Create one to enable A2A access for external agents.</p>
          </CardContent>
        </Card>
      )}

      {/* Revoked Keys */}
      {revokedKeys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-gray-500">Revoked Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {revokedKeys.map(key => (
                <div
                  key={key.uuid}
                  className="flex items-center gap-3 p-3 border border-dashed rounded-lg opacity-60"
                >
                  <Key className="h-4 w-4 text-gray-400" />
                  <div>
                    <span className="text-sm text-gray-600">{key.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{key.companyName}</span>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded ml-2">{key.keyPrefix}...</code>
                  </div>
                  <Badge variant="outline" className="text-xs text-gray-400 ml-auto">Revoked</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && handleCloseCreate()}>
        <DialogContent>
          {!newKey ? (
            <>
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
                <DialogDescription>
                  Create an API key to allow external agents to access the A2A protocol on behalf of a brand.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div>
                  <Label className="mb-1.5 block">Key Name</Label>
                  <Input
                    placeholder="e.g. Production Agent, CI/CD Pipeline"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Brand</Label>
                  <SelectRoot value={selectedCompany} onValueChange={setSelectedCompany}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map(c => (
                        <SelectItem key={c.uuid} value={c.uuid}>{c.companyName}</SelectItem>
                      ))}
                    </SelectContent>
                  </SelectRoot>
                </div>

                {createError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{createError}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseCreate}>Cancel</Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !keyName.trim() || !selectedCompany}
                >
                  {creating ? 'Creating...' : 'Create Key'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>API Key Created</DialogTitle>
                <DialogDescription>
                  Copy your API key now. You won't be able to see it again.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-700">
                    This is the only time the full key will be shown. Store it securely.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-gray-100 rounded-lg text-sm font-mono break-all">
                    {newKey}
                  </code>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={handleCloseCreate}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={!!showRevoke} onOpenChange={(open) => !open && setShowRevoke(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              This will immediately disable the API key. Any agents using it will lose access. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevoke(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => showRevoke && handleRevoke(showRevoke)}
              disabled={revoking}
            >
              {revoking ? 'Revoking...' : 'Revoke Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
