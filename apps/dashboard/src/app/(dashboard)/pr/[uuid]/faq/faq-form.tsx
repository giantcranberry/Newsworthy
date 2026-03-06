'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { WizardHeader } from '@/components/pr-wizard/wizard-header'
import { Loader2, Sparkles, RefreshCw, HelpCircle, Check } from 'lucide-react'

interface Faq {
  question: string
  answer: string
}

interface FaqFormProps {
  releaseUuid: string
  existingFaqs: Faq[]
  releaseTitle: string
  children?: React.ReactNode
}

export function FaqForm({ releaseUuid, existingFaqs, releaseTitle, children }: FaqFormProps) {
  const router = useRouter()
  const [faqs, setFaqs] = useState<Faq[]>(existingFaqs)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasFaqs = faqs.length > 0

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch(`/api/pr/${releaseUuid}/faq/generate`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate FAQs')
      }

      const data = await response.json()
      setFaqs(data.faqs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  const updateFaq = (index: number, field: 'question' | 'answer', value: string) => {
    setFaqs(prev => prev.map((faq, i) =>
      i === index ? { ...faq, [field]: value } : faq
    ))
  }

  const saveFaqs = async () => {
    setIsSaving(true)
    setError(null)
    setSaved(false)

    try {
      const response = await fetch(`/api/pr/${releaseUuid}/faq`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faqs }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save FAQs')
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      window.dispatchEvent(new Event('preview-refresh'))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!hasFaqs) return false
    return await saveFaqs()
  }

  return (
    <div className="space-y-6">
      <WizardHeader
        title="AI Discovery Optimization"
        description="Optional (Recommended)"
        releaseUuid={releaseUuid}
        currentStep={3}
        isLoading={isSaving}
        onSubmit={handleSubmit}
        canProceed={hasFaqs}
        showSkip
      />
      {children}

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 p-3 rounded-lg">
          {error}
        </div>
      )}

      {!hasFaqs && !isGenerating && (
        <Card>
          <CardContent className="py-10">
            <div className="text-center space-y-6">
              <div className="mx-auto w-14 h-14 rounded-full bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Discovery Optimization</h2>
                <p className="text-base font-medium text-gray-500 dark:text-gray-400">Optional (Recommended)</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 max-w-lg mx-auto leading-relaxed">
                  AI will analyze your press release and identify questions people are likely asking
                  AI assistants (ChatGPT, Perplexity, Google AI Overviews) where your release fills
                  an information gap. These FAQs help AI systems discover and cite your news.
                </p>
              </div>
              <Button
                onClick={handleGenerate}
                size="lg"
                className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
              >
                <Sparkles className="h-4 w-4" />
                Generate FAQs
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isGenerating && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-600 dark:text-cyan-400 mx-auto" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Analyzing your press release and generating FAQs...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {hasFaqs && !isGenerating && (
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Question {index + 1}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Question</label>
                  <Textarea
                    value={faq.question}
                    onChange={(e) => updateFaq(index, 'question', e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Answer</label>
                  <Textarea
                    value={faq.answer}
                    onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={isGenerating || isSaving}
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </Button>
            <Button
              onClick={saveFaqs}
              disabled={isSaving}
              className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <Check className="h-4 w-4" />
                  Saved
                </>
              ) : (
                'Save FAQs'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
