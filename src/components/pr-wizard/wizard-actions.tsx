'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, SkipForward, Loader2 } from 'lucide-react'
import { STEPS } from './wizard-nav'

interface WizardActionsProps {
  releaseUuid: string
  currentStep: number
  isLoading?: boolean
  onSubmit?: () => void | boolean | Promise<void | boolean>
  canProceed?: boolean
  showSkip?: boolean
  submitLabel?: string
}

export function WizardActions({
  releaseUuid,
  currentStep,
  isLoading = false,
  onSubmit,
  canProceed = true,
  showSkip = false,
  submitLabel,
}: WizardActionsProps) {
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
      // If onSubmit returns false, don't navigate (e.g., payment form is being shown)
      if (result === false) {
        return
      }
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

  // For the last step, use a different label
  const isLastStep = currentStep === STEPS.length
  const nextLabel = submitLabel || (isLastStep ? 'Finish' : 'Next')

  return (
    <div className="flex items-center justify-between pt-6 border-t border-gray-100">
      <div>
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
      </div>

      <div className="flex items-center gap-2">
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

        <Button
          type={onSubmit ? 'button' : 'submit'}
          onClick={onSubmit ? handleNext : undefined}
          disabled={isLoading || !canProceed}
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
      </div>
    </div>
  )
}
