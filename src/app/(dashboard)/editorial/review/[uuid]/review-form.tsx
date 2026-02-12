'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, CheckCircle, XCircle, Loader2, User, Building2, Calendar, Tag, MapPin } from 'lucide-react'

interface ReviewFormProps {
  release: {
    id: number
    uuid: string
    title: string | null
    abstract: string | null
    body: string | null
    status: string | null
    releaseAt: Date | null
    createdAt: Date | null
  }
  queue: {
    id: number
    submitted: Date | null
    editorId: number | null
    editorName: string | null
  }
  company: {
    id: number
    companyName: string | null
  }
  user: {
    id: number
    email: string
  }
  categoryNames: (string | null)[]
  regionNames: (string | null)[]
  editorId: number
  editorName: string
}

export function ReviewForm({
  release,
  queue,
  company,
  user,
  categoryNames,
  regionNames,
  editorId,
  editorName,
}: ReviewFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [notes, setNotes] = useState('')

  const handleCheckout = async () => {
    try {
      const response = await fetch(`/api/editorial/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueId: queue.id,
          editorId,
          editorName,
        }),
      })

      if (response.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Error checking out:', error)
    }
  }

  const handleAction = async (actionType: 'approve' | 'reject') => {
    setIsLoading(true)
    setAction(actionType)

    try {
      const response = await fetch(`/api/editorial/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: release.id,
          queueId: queue.id,
          action: actionType,
          notes,
          editorId,
          editorName,
        }),
      })

      if (response.ok) {
        router.push('/editorial/queue')
        router.refresh()
      } else {
        const error = await response.json()
        alert(error.message || `Failed to ${actionType} release`)
      }
    } catch (error) {
      console.error(`Error ${actionType}ing release:`, error)
      alert(`An error occurred while ${actionType}ing the release`)
    } finally {
      setIsLoading(false)
      setAction(null)
    }
  }

  const isCheckedOut = queue.editorId === editorId
  const isCheckedOutByOther = queue.editorId && queue.editorId !== editorId

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/editorial/queue">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Queue
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Review Release</h1>
            <p className="text-gray-500">#{release.id}</p>
          </div>
        </div>
        {!isCheckedOut && !isCheckedOutByOther && (
          <Button onClick={handleCheckout}>Check Out for Review</Button>
        )}
        {isCheckedOutByOther && (
          <span className="text-sm text-amber-600">
            Checked out by {queue.editorName}
          </span>
        )}
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Release Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">Company:</span>
              <span className="font-medium">{company.companyName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">Author:</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">Submitted:</span>
              <span className="font-medium">
                {queue.submitted ? new Date(queue.submitted).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">Release Date:</span>
              <span className="font-medium">
                {release.releaseAt ? new Date(release.releaseAt).toLocaleDateString() : 'Immediate'}
              </span>
            </div>
            {categoryNames.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Tag className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Category:</span>
                <span className="font-medium">{categoryNames.join(', ')}</span>
              </div>
            )}
            {regionNames.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Region:</span>
                <span className="font-medium">{regionNames.join(', ')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content Preview */}
      <Card>
        <CardHeader>
          <CardTitle>{release.title || 'Untitled Release'}</CardTitle>
          {release.abstract && (
            <CardDescription className="text-base">{release.abstract}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {release.body ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: release.body }}
            />
          ) : (
            <p className="text-gray-500 italic">No content</p>
          )}
        </CardContent>
      </Card>

      {/* Review Actions */}
      {(isCheckedOut || (!queue.editorId)) && (
        <Card>
          <CardHeader>
            <CardTitle>Review Decision</CardTitle>
            <CardDescription>Approve or reject this press release</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="notes">Editor Notes (optional)</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes for the author or internal reference..."
                className="mt-1 w-full h-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Button
                onClick={() => handleAction('approve')}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading && action === 'approve' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Approve Release
              </Button>

              <Button
                onClick={() => handleAction('reject')}
                disabled={isLoading}
                variant="destructive"
              >
                {isLoading && action === 'reject' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Reject / Return
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
