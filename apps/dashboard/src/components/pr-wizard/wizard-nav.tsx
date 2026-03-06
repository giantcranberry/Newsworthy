'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { FileText, Image, ImageIcon, Share2, Sparkles, ClipboardCheck, Flag, Check, HelpCircle } from 'lucide-react'

interface WizardStep {
  id: number
  name: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  optional?: boolean
}

const STEPS: WizardStep[] = [
  { id: 1, name: 'Details', path: '', icon: FileText },
  { id: 2, name: 'Logo', path: '/logo', icon: Image },
  { id: 3, name: 'FAQ', path: '/faq', icon: HelpCircle, optional: true },
  { id: 4, name: 'Images', path: '/images', icon: ImageIcon },
  { id: 5, name: 'Share', path: '/share', icon: Share2, optional: true },
  { id: 6, name: 'Upgrades', path: '/upgrades', icon: Sparkles },
  { id: 7, name: 'Review', path: '/review', icon: ClipboardCheck },
  { id: 8, name: 'Finalize', path: '/finalize', icon: Flag },
]

interface Release {
  uuid: string
  primaryImageId?: number | null
  bannerId?: number | null
  distribution?: string | null
  title?: string | null
  abstract?: string | null
  body?: string | null
  location?: string | null
  videoUrl?: string | null
  faqCount?: number
}

interface Company {
  logoUrl?: string | null
  companyName?: string | null
}

interface ReleaseOptions {
  advocacy?: boolean | null
}

interface WizardNavProps {
  releaseUuid: string
  currentStep: number
  release?: Release
  company?: Company
  releaseOptions?: ReleaseOptions
}

function getStepStatus(
  step: WizardStep,
  currentStep: number,
  release?: Release,
  company?: Company,
  releaseOptions?: ReleaseOptions
): 'completed' | 'current' | 'upcoming' {
  if (step.id < currentStep) {
    return 'completed'
  }
  if (step.id === currentStep) {
    return 'current'
  }
  return 'upcoming'
}

function isStepComplete(
  step: WizardStep,
  release?: Release,
  company?: Company,
  releaseOptions?: ReleaseOptions
): boolean {
  switch (step.id) {
    case 1: // Details
      return !!(release?.title && release?.abstract && release?.body)
    case 2: // Logo
      return !!company?.logoUrl
    case 3: // FAQ
      return (release?.faqCount ?? 0) > 0
    case 4: // Images (News Images optional, Social Banner required)
      return !!release?.bannerId
    case 5: // Share
      return releaseOptions?.advocacy !== undefined
    case 6: // Upgrades
      return !!release?.distribution
    case 7: // Review
      return false // Review step is complete when user confirms
    case 8: // Finalize
      return false // Finalize is the final step
    default:
      return false
  }
}

export function WizardNav({
  releaseUuid,
  currentStep,
  release,
  company,
  releaseOptions,
}: WizardNavProps) {
  return (
      <nav aria-label="Progress" className="mb-8 px-8">
        <ol className="flex items-center">
          {STEPS.map((step, stepIdx) => {
            const status = getStepStatus(step, currentStep, release, company, releaseOptions)
            const isComplete = isStepComplete(step, release, company, releaseOptions)
            const Icon = step.icon
            const href = step.path ? `/pr/${releaseUuid}${step.path}` : `/pr/${releaseUuid}`

            // Detect transition line: this step is completed and the next is current
            const nextStep = stepIdx < STEPS.length - 1 ? STEPS[stepIdx + 1] : null
            const nextStatus = nextStep ? getStepStatus(nextStep, currentStep, release, company, releaseOptions) : null
            const isTransitionLine = status === 'completed' && nextStatus === 'current'

            return (
              <li
                key={step.id}
                className={cn('relative flex items-center', stepIdx !== STEPS.length - 1 && 'flex-1')}
              >
                <Link
                  href={href}
                  style={{ minWidth: 40, minHeight: 40 }}
                  className={cn(
                    'relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors',
                    status === 'completed' && 'bg-emerald-600 text-white hover:bg-emerald-700',
                    status === 'current' && 'bg-cyan-700 text-white wizard-step-current',
                    status === 'upcoming' && !step.optional && 'border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:border-gray-400',
                    status === 'upcoming' && step.optional && 'border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-400 hover:border-gray-400'
                  )}
                  title={`${step.name}${step.optional ? ' (Optional)' : ''}`}
                >
                  {isComplete && status !== 'current' ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </Link>

                <span
                  className={cn(
                    'absolute -bottom-6 left-5 -translate-x-1/2 whitespace-nowrap text-xs font-medium',
                    status === 'current' && 'text-cyan-700',
                    status === 'completed' && 'text-emerald-600',
                    status === 'upcoming' && 'text-gray-500 dark:text-gray-400'
                  )}
                >
                  {step.name}
                  {step.optional && <span className="text-gray-400 ml-0.5">*</span>}
                </span>

                {stepIdx !== STEPS.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1',
                      isTransitionLine && 'wizard-gradient-line',
                      !isTransitionLine && status === 'completed' && 'bg-emerald-600',
                      !isTransitionLine && status !== 'completed' && 'bg-gray-200 dark:bg-gray-700'
                    )}
                    aria-hidden="true"
                  />
                )}
              </li>
            )
          })}
        </ol>
        <p className="mt-10 text-xs text-gray-400">* Optional step</p>
      </nav>
  )
}

export { STEPS }
export type { WizardStep }
