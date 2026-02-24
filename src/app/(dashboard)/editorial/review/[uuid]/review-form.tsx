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
      <div className="space-y-3">
        <Link href="/editorial/queue" className="inline-flex items-center text-sm text-cyan-800 hover:text-cyan-900 font-medium">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Queue
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Review Release</h1>
            <p className="text-gray-500">#{release.id}</p>
          </div>
          {!isCheckedOut && !isCheckedOutByOther && (
            <Button onClick={handleCheckout} className="bg-cyan-800 text-white hover:bg-cyan-900">Check Out for Review</Button>
          )}
          {isCheckedOutByOther && (
            <span className="text-sm text-amber-600">
              Checked out by {queue.editorName}
            </span>
          )}
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Release Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Building2 className="h-3.5 w-3.5" />
                Company
              </div>
              <p className="text-sm font-medium text-gray-700">{company.companyName}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <User className="h-3.5 w-3.5" />
                Author
              </div>
              <p className="text-sm font-medium text-gray-700">{user.email}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar className="h-3.5 w-3.5" />
                Submitted
              </div>
              <p className="text-sm font-medium text-gray-700">
                {queue.submitted ? new Date(queue.submitted).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar className="h-3.5 w-3.5" />
                Release Date
              </div>
              <p className="text-sm font-medium text-gray-700">
                {release.releaseAt ? new Date(release.releaseAt).toLocaleDateString() : 'Immediate'}
              </p>
            </div>
          </div>
          {(categoryNames.length > 0 || regionNames.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
              {categoryNames.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Tag className="h-3.5 w-3.5" />
                    Category
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {categoryNames.map((name) => (
                      <span key={name} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {regionNames.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin className="h-3.5 w-3.5" />
                    Region
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {regionNames.map((name) => (
                      <span key={name} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Preview */}
      <Card>
        <CardHeader>
          <CardTitle>{release.title || 'Untitled Release'}</CardTitle>
          {release.abstract && (
            <CardDescription className="text-base text-gray-700">{release.abstract}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {release.body ? (
            <div
              className="prose prose-sm prose-gray max-w-none prose-a:text-cyan-800"
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
                className="mt-1 w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-700 focus:border-cyan-700 resize-none text-gray-700 placeholder:text-gray-400 placeholder:text-xs"
              />
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Button
                onClick={() => handleAction('approve')}
                disabled={isLoading}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
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
                className="bg-red-600 text-white hover:bg-red-700"
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
