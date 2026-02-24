'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, SkipForward, Loader2 } from 'lucide-react'
import { STEPS } from './wizard-nav'

interface WizardHeaderProps {
  title: string
  description?: string
  releaseUuid: string
  currentStep: number
  isLoading?: boolean
  onSubmit?: () => void | boolean | Promise<void | boolean>
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
  canProceed = true,
  showSkip = false,
  submitLabel,
  hideNext = false,
}: WizardHeaderProps) {
  const router = useRouter()

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
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 -mx-6 px-6 py-4 -mt-6 mb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-800 truncate">{title}</h1>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
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
              className="bg-cyan-800 text-white hover:bg-cyan-900 disabled:opacity-50"
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
        </div>
      </div>
    </div>
  )
}
