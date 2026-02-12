'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { WizardActions } from '@/components/pr-wizard/wizard-actions'
import { Share2, X, Check, Users, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ShareFormProps {
  releaseUuid: string
  companyUuid: string
  shareWithList: boolean
  companyName: string
  listCount: number
}

export function ShareForm({
  releaseUuid,
  companyUuid,
  shareWithList: initialShareWithList,
  companyName,
  listCount: initialListCount,
}: ShareFormProps) {
  const router = useRouter()
  const [shareWithList, setShareWithList] = useState(initialShareWithList)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add to list state
  const [showAddForm, setShowAddForm] = useState(false)
  const [emails, setEmails] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addResult, setAddResult] = useState<{ added: number; skipped: number } | null>(null)
  const [listCount, setListCount] = useState(initialListCount)

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/pr/${releaseUuid}/share`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advocacy: shareWithList }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save sharing preference')
      }

      router.push(`/pr/${releaseUuid}/distribution`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddToList = async () => {
    if (!emails.trim()) return

    setIsAdding(true)
    setAddResult(null)
    setError(null)

    try {
      const response = await fetch(`/api/company/${companyUuid}/advocacy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: emails.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add to list')
      }

      setAddResult({ added: data.added, skipped: data.skipped })
      setListCount((prev) => prev + data.added)
      setEmails('')

      // Auto-select share with list if they just added people
      if (data.added > 0 && !shareWithList) {
        setShareWithList(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to list')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add to My List Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">My List</CardTitle>
              <CardDescription>
                {listCount === 0
                  ? 'Add subscribers to share your releases with'
                  : `${listCount} active subscriber${listCount === 1 ? '' : 's'} in your list`
                }
              </CardDescription>
            </div>
            {!showAddForm && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4" />
                Add to My List
              </Button>
            )}
          </div>
        </CardHeader>

        {showAddForm && (
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="emails">Add Email Addresses</Label>
              <Textarea
                id="emails"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="Enter one email per line, or use format:&#10;email@example.com, First Name, Last Name"
                rows={5}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Add up to 100 emails at a time. Use commas to include first and last names.
              </p>
            </div>

            {addResult && (
              <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                <Check className="h-4 w-4" />
                Added {addResult.added} subscriber{addResult.added === 1 ? '' : 's'}
                {addResult.skipped > 0 && ` (${addResult.skipped} skipped - already in list or invalid)`}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleAddToList}
                disabled={isAdding || !emails.trim()}
              >
                {isAdding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add to List
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowAddForm(false)
                  setEmails('')
                  setAddResult(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Share Options Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Share with My List</CardTitle>
          <CardDescription>
            Choose whether to share this press release with your subscribers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Enable Option */}
            <button
              type="button"
              onClick={() => setShareWithList(true)}
              disabled={listCount === 0}
              className={cn(
                'relative flex flex-col items-start p-4 rounded-lg border-2 transition-colors text-left',
                shareWithList
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300',
                listCount === 0 && 'opacity-50 cursor-not-allowed'
              )}
            >
              {shareWithList && (
                <div className="absolute top-3 right-3">
                  <div className="bg-blue-500 text-white p-1 rounded-full">
                    <Check className="h-3 w-3" />
                  </div>
                </div>
              )}
              <div className={cn(
                'p-2 rounded-lg mb-3',
                shareWithList ? 'bg-blue-100' : 'bg-gray-100'
              )}>
                <Share2 className={cn(
                  'h-6 w-6',
                  shareWithList ? 'text-blue-600' : 'text-gray-500'
                )} />
              </div>
              <h3 className="font-medium text-gray-900 mb-1">
                Share with My List
              </h3>
              <p className="text-sm text-gray-500">
                {listCount === 0
                  ? 'Add subscribers above to enable sharing'
                  : `Email this release to ${listCount} subscriber${listCount === 1 ? '' : 's'} when published`
                }
              </p>
            </button>

            {/* Disable Option */}
            <button
              type="button"
              onClick={() => setShareWithList(false)}
              className={cn(
                'relative flex flex-col items-start p-4 rounded-lg border-2 transition-colors text-left',
                !shareWithList
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              {!shareWithList && (
                <div className="absolute top-3 right-3">
                  <div className="bg-blue-500 text-white p-1 rounded-full">
                    <Check className="h-3 w-3" />
                  </div>
                </div>
              )}
              <div className={cn(
                'p-2 rounded-lg mb-3',
                !shareWithList ? 'bg-blue-100' : 'bg-gray-100'
              )}>
                <X className={cn(
                  'h-6 w-6',
                  !shareWithList ? 'text-blue-600' : 'text-gray-500'
                )} />
              </div>
              <h3 className="font-medium text-gray-900 mb-1">
                Skip Sharing
              </h3>
              <p className="text-sm text-gray-500">
                Continue without sharing to your list
              </p>
            </button>
          </div>

          {shareWithList && listCount > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">What happens next?</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Your {listCount} subscriber{listCount === 1 ? '' : 's'} will receive an email when the release is published</li>
                <li>• They can easily share the news on their social networks</li>
                <li>• Track engagement from your dashboard</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <WizardActions
        releaseUuid={releaseUuid}
        currentStep={4}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        canProceed={true}
      />
    </div>
  )
}
