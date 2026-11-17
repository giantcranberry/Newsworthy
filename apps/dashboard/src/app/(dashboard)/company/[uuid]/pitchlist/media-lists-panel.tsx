'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowRight, List, Loader2, Lock, Pencil, Plus, Sparkles, Trash2, Users } from 'lucide-react'

export interface MediaListItem {
  uuid: string
  name: string
  description: string | null
  isCurated: boolean
  contactCount: number
}

interface MediaListsPanelProps {
  readOnly?: boolean
  companyUuid: string
  lists: MediaListItem[]
}

type DialogState =
  | { mode: 'create' }
  | { mode: 'edit'; list: MediaListItem }
  | { mode: 'delete'; list: MediaListItem }
  | null

export function MediaListsPanel({ readOnly, companyUuid, lists }: MediaListsPanelProps) {
  const router = useRouter()
  const [dialog, setDialog] = useState<DialogState>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const curated = lists.find((l) => l.isCurated)
  const userLists = lists.filter((l) => !l.isCurated)

  const open = (next: DialogState) => {
    setError(null)
    if (next?.mode === 'edit') {
      setName(next.list.name)
      setDescription(next.list.description || '')
    } else {
      setName('')
      setDescription('')
    }
    setDialog(next)
  }

  const submit = async () => {
    if (!dialog) return
    setSaving(true)
    setError(null)
    try {
      const base = `/api/company/${companyUuid}/media-lists`
      const res =
        dialog.mode === 'create'
          ? await fetch(base, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, description }),
            })
          : dialog.mode === 'edit'
            ? await fetch(`${base}/${dialog.list.uuid}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description }),
              })
            : await fetch(`${base}/${dialog.list.uuid}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Something went wrong')
      }
      setDialog(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="bg-gray-50 dark:bg-gray-950 border-b rounded-t-lg">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base flex items-center gap-2">
            <List className="h-4 w-4" />
            Media Lists
          </CardTitle>
          {!readOnly && (
            <Button size="sm" onClick={() => open({ mode: 'create' })}>
              <Plus className="h-4 w-4" />
              New List
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {curated && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-cyan-200 bg-cyan-50/60 dark:border-cyan-900 dark:bg-cyan-950/30 p-4">
            <div className="flex items-start gap-3 min-w-0">
              <Sparkles className="h-5 w-5 text-cyan-700 dark:text-cyan-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{curated.name}</p>
                  <Badge variant="secondary" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Managed by Newsworthy
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {curated.contactCount} journalist{curated.contactCount !== 1 ? 's' : ''} researched for your brand.
                  Select this list when you publish; each journalist receives at most one release from you every 28 days.
                </p>
              </div>
            </div>
            <Link href={`/company/${companyUuid}/pitchlist/curated/${curated.uuid}`} className="shrink-0">
              <Button variant="outline" size="sm">
                View
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}

        {userLists.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No lists yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {userLists.map((list) => (
              <li key={list.uuid} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{list.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {list.contactCount} contact{list.contactCount !== 1 ? 's' : ''}
                    {list.description && <span className="truncate"> · {list.description}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!readOnly && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => open({ mode: 'edit', list })} aria-label={`Rename ${list.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => open({ mode: 'delete', list })} aria-label={`Delete ${list.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Link href={`/company/${companyUuid}/pitchlist/manage?list=${list.uuid}`}>
                    <Button variant="outline" size="sm">
                      Manage
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          {dialog?.mode === 'delete' ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete &ldquo;{dialog.list.name}&rdquo;?</DialogTitle>
                <DialogDescription>
                  The list is removed. Its {dialog.list.contactCount} contact{dialog.list.contactCount !== 1 ? 's' : ''} stay in your media contacts and on any other lists.
                </DialogDescription>
              </DialogHeader>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{dialog?.mode === 'edit' ? 'Edit List' : 'New Media List'}</DialogTitle>
                <DialogDescription>Group media contacts so you can choose who receives each release.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div>
                  <Label htmlFor="list-name">Name *</Label>
                  <Input id="list-name" value={name} maxLength={48} onChange={(e) => setName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="list-description">Description</Label>
                  <Textarea id="list-description" value={description} rows={2} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
                </div>
              </div>
            </>
          )}

          {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">{error}</div>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant={dialog?.mode === 'delete' ? 'destructive' : 'default'}
              onClick={submit}
              disabled={saving || (dialog?.mode !== 'delete' && !name.trim())}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {dialog?.mode === 'delete' ? 'Delete List' : dialog?.mode === 'edit' ? 'Save' : 'Create List'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
