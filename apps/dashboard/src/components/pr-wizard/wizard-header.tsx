'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, SkipForward, Loader2, Eye, EyeOff } from 'lucide-react'
import { STEPS } from './wizard-nav'

interface WizardHeaderProps {
  title: string
  description?: string
  releaseUuid: string
  currentStep: number
  isLoading?: boolean
  onSubmit?: () => void | boolean | Promise<void | boolean>
  onNext?: () => boolean | void
  canProceed?: boolean
  showSkip?: boolean
  submitLabel?: string
  hideNext?: boolean
}

export function WizardHeader({
  title,
  description,
  releaseUuid,
  currentStep,
  isLoading = false,
  onSubmit,
  onNext,
  canProceed = true,
  showSkip = false,
  submitLabel,
  hideNext = false,
}: WizardHeaderProps) {
  const router = useRouter()
  const [previewVisible, setPreviewVisible] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      setPreviewVisible((e as CustomEvent<{ visible: boolean }>).detail.visible)
    }
    window.addEventListener('preview-visibility', handler)
    return () => window.removeEventListener('preview-visibility', handler)
  }, [])

  const togglePreview = () => {
    window.dispatchEvent(new CustomEvent('toggle-preview'))
  }

  const prevStep = STEPS.find((s) => s.id === currentStep - 1)
  const nextStep = STEPS.find((s) => s.id === currentStep + 1)
  const currentStepConfig = STEPS.find((s) => s.id === currentStep)
  const isOptional = currentStepConfig?.optional

  const prevPath = prevStep
    ? prevStep.path
      ? `/pr/${releaseUuid}${prevStep.path}`
      : `/pr/${releaseUuid}`
    : null

  const nextPath = nextStep
    ? `/pr/${releaseUuid}${nextStep.path}`
    : null

  const handleNext = async () => {
    if (onNext) {
      const result = onNext()
      if (result === false) return
    }
    if (onSubmit) {
      const result = await onSubmit()
      if (result === false) return
    }
    if (nextPath) {
      router.push(nextPath)
    }
  }

  const handleSkip = () => {
    if (nextPath) {
      router.push(nextPath)
    }
  }

  const handleBack = () => {
    if (prevPath) {
      router.push(prevPath)
    }
  }

  const isLastStep = currentStep === STEPS.length
  const nextLabel = submitLabel || (isLastStep ? 'Finish' : 'Next')

  return (
    <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4 -mt-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{title}</h1>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {prevPath && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          {(showSkip || isOptional) && nextPath && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              disabled={isLoading}
            >
              <SkipForward className="h-4 w-4" />
              Skip
            </Button>
          )}
          {!hideNext && (
            <Button
              type="button"
              onClick={handleNext}
              disabled={isLoading || !canProceed}
              className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {nextLabel}
                  {!isLastStep && <ChevronRight className="h-4 w-4" />}
                </>
              )}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={togglePreview}
            className="hidden xl:inline-flex"
          >
            {previewVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {previewVisible ? 'Hide Preview' : 'Preview Your Release'}
          </Button>
        </div>
      </div>
    </div>
  )
}
