'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, CheckCircle, XCircle, Loader2, User, Building2, Calendar, Tag, MapPin, Hand, RotateCcw } from 'lucide-react'

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
    distribution: string | null
    score: number | null
    isFeatured: boolean | null
  }
  queue: {
    id: number
    submitted: Date | null
    editorId: number | null
    editorName: string | null
    checkedout: Date | null
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
  releaseNotes: { id: number; note: string | null; fromName: string | null; createdAt: Date | null }[]
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
  releaseNotes,
}: ReviewFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [action, setAction] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [score, setScore] = useState(release.score?.toString() || '4')
  const [distribution, setDistribution] = useState(release.distribution || 'standard')
  const [feature, setFeature] = useState(release.isFeatured || false)

  const handleCheckout = async () => {
    try {
      const response = await fetch('/api/editorial/checkout', {
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

  const handleDisown = async () => {
    setIsLoading(true)
    setAction('disown')
    try {
      const response = await fetch('/api/editorial/disown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueId: queue.id,
          releaseId: release.id,
          editorId,
          editorName,
          notes: notes || undefined,
        }),
      })

      if (response.ok) {
        router.push('/editorial/queue')
        router.refresh()
      }
    } catch (error) {
      console.error('Error disowning:', error)
    } finally {
      setIsLoading(false)
      setAction(null)
    }
  }

  const handleAction = async (actionType: 'approve' | 'hold' | 'reject') => {
    if (actionType === 'hold' && (!notes || !notes.trim())) {
      alert('Notes are required when placing a release on editorial hold.')
      return
    }

    setIsLoading(true)
    setAction(actionType)

    try {
      const response = await fetch('/api/editorial/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: release.id,
          queueId: queue.id,
          action: actionType,
          notes,
          editorId,
          editorName,
          score: actionType === 'approve' ? score : undefined,
          distribution: actionType === 'approve' ? distribution : undefined,
          feature: actionType === 'approve' ? feature : undefined,
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
      alert(`An error occurred while processing the release`)
    } finally {
      setIsLoading(false)
      setAction(null)
    }
  }

  const isCheckedOut = queue.editorId === editorId
  const isCheckedOutByOther = queue.editorId && queue.editorId !== editorId
  const canAct = isCheckedOut || (!queue.editorId)

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
          <div className="flex items-center gap-2">
            <Link href={`/editorial/edit/${release.id}`}>
              <Button variant="outline">Edit Release</Button>
            </Link>
            {!isCheckedOut && !isCheckedOutByOther && (
              <Button onClick={handleCheckout} className="bg-cyan-800 text-white hover:bg-cyan-900">
                Check Out for Review
              </Button>
            )}
            {isCheckedOutByOther && (
              <span className="text-sm text-amber-600">
                Checked out by {queue.editorName}
              </span>
            )}
            {isCheckedOut && (
              <span className="text-sm text-green-700 font-medium">
                Checked out by you
              </span>
            )}
          </div>
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
                    Categories
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
                    Regions
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

      {/* Staff Notes */}
      {releaseNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Staff Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {releaseNotes.map((rn) => (
              <div key={rn.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <p className="text-sm text-gray-700">{rn.note}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {rn.fromName} &mdash; {rn.createdAt ? new Date(rn.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
      {canAct && (
        <>
          {/* Approval Section */}
          <Card>
            <CardHeader>
              <CardTitle>Approve Release</CardTitle>
              <CardDescription>Set editorial score and distribution before approving</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="score">Editorial Score</Label>
                  <select
                    id="score"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="mt-1 w-full h-9 px-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-cyan-700 focus:border-cyan-700"
                  >
                    <option value="5">5 - Exceptional</option>
                    <option value="4">4 - Average</option>
                    <option value="3">3 - Secondary Distribution</option>
                    <option value="2">2 - No Network Distribution</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="distribution">Distribution</Label>
                  <select
                    id="distribution"
                    value={distribution}
                    onChange={(e) => setDistribution(e.target.value)}
                    className="mt-1 w-full h-9 px-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-cyan-700 focus:border-cyan-700"
                  >
                    <option value="standard">Standard</option>
                    <option value="yahoo">Yahoo</option>
                    <option value="enhanced">Enhanced</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={feature}
                      onChange={(e) => setFeature(e.target.checked)}
                      className="rounded border-gray-300 text-cyan-800 focus:ring-cyan-700"
                    />
                    <span className="text-sm text-gray-700">Feature Release</span>
                  </label>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Editor Notes (optional)</Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes for the author or internal reference..."
                  className="mt-1 w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-700 focus:border-cyan-700 resize-none text-sm text-gray-700 placeholder:text-gray-400"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
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
              </div>
            </CardContent>
          </Card>

          {/* Hold / Reject / Disown Section */}
          <Card>
            <CardHeader>
              <CardTitle>Other Actions</CardTitle>
              <CardDescription>Hold, reject, or return this release to the queue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  onClick={() => handleAction('hold')}
                  disabled={isLoading}
                  className="bg-amber-600 text-white hover:bg-amber-700"
                >
                  {isLoading && action === 'hold' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Hand className="h-4 w-4 mr-2" />
                  )}
                  Editorial Hold
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
                  Reject / Return to Draft
                </Button>

                {isCheckedOut && (
                  <Button
                    onClick={handleDisown}
                    disabled={isLoading}
                    variant="outline"
                  >
                    {isLoading && action === 'disown' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-2" />
                    )}
                    Disown / Return to Queue
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                <strong>Hold:</strong> Places the release on editorial hold (requires notes). <strong>Reject:</strong> Returns to draft status. <strong>Disown:</strong> Removes your checkout so another editor can claim it.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}
