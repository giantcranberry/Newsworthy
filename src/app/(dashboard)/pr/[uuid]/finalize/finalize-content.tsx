'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Flag, Loader2, Check, AlertCircle, Sparkles, Lightbulb } from 'lucide-react'

interface Suggestion {
  headline: string
  strategy: string
  explanation: string
}

interface FinalizeContentProps {
  releaseUuid: string
  releaseTitle: string
  distribution: string | null
}

export function FinalizeContent({
  releaseUuid,
  releaseTitle,
  distribution,
}: FinalizeContentProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Expert Suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)

  const handleExpertSuggestions = async () => {
    setShowSuggestions(true)
    setIsLoadingSuggestions(true)
    setSuggestionsError(null)
    setSuggestions([])

    try {
      const response = await fetch(`/api/pr/${releaseUuid}/ai-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate suggestions')
      }

      setSuggestions(data.suggestions)
    } catch (err) {
      setSuggestionsError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoadingSuggestions(false)
    }
  }

  const handleSubmit = async () => {
    if (!confirmed) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/pr/${releaseUuid}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit release')
      }

      setSuccess(true)
      // Redirect to release page after short delay
      setTimeout(() => {
        router.push(`/pr/${releaseUuid}?wizard=complete`)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center py-8">
            <div className="bg-green-100 p-4 rounded-full mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-green-900 mb-2">
              Press Release Submitted!
            </h3>
            <p className="text-green-700">
              Your press release has been submitted for distribution. Redirecting...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <Flag className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle>Ready to Submit</CardTitle>
              <CardDescription>
                Submit your press release for distribution
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-gray-50 rounded-lg space-y-2">
            <p className="text-sm text-gray-500">Press Release</p>
            <p className="font-medium text-gray-900">{releaseTitle}</p>
            <p className="text-sm text-gray-500 mt-2">Distribution</p>
            <p className="text-sm font-medium">
              {distribution === 'premium' && 'Premium Distribution'}
              {distribution === 'yahoo' && 'Yahoo Finance Distribution'}
              {distribution === 'standard' && 'Standard Distribution'}
              {!distribution && 'Standard Distribution'}
            </p>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="confirm"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
              />
              <Label htmlFor="confirm" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
                I confirm that I have reviewed my press release and all information is accurate.
                I understand that once submitted, the release will be distributed according to the selected options.
              </Label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSubmit}
              disabled={!confirmed || isSubmitting}
              className="flex-1"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4" />
                  Submit Press Release
                </>
              )}
            </Button>
            <Button
              onClick={handleExpertSuggestions}
              variant="outline"
              size="lg"
              className="flex-1 sm:flex-initial"
            >
              <Sparkles className="h-4 w-4" />
              Expert Suggestions
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expert Suggestions Dialog */}
      <Dialog open={showSuggestions} onOpenChange={setShowSuggestions}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Expert Headline Suggestions
            </DialogTitle>
            <DialogDescription>
              AI-generated headline alternatives optimized for different SEO strategies
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isLoadingSuggestions && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-600">Analyzing your press release...</p>
                <p className="text-sm text-gray-400 mt-1">Generating expert suggestions</p>
              </div>
            )}

            {suggestionsError && (
              <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{suggestionsError}</span>
              </div>
            )}

            {!isLoadingSuggestions && !suggestionsError && suggestions.length > 0 && (
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Current Headline</p>
                  <p className="font-medium text-gray-900">{releaseTitle}</p>
                </div>

                <div className="space-y-3">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="bg-blue-100 p-2 rounded-full shrink-0">
                          <Lightbulb className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                              {suggestion.strategy}
                            </span>
                          </div>
                          <p className="font-medium text-gray-900">{suggestion.headline}</p>
                          <p className="text-sm text-gray-600">{suggestion.explanation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-gray-500 text-center pt-2">
                  These suggestions are AI-generated. Review and adapt them to fit your brand voice and messaging goals.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
