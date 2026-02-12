'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { FileText, Image, ImageIcon, Share2, Sparkles, ClipboardCheck, Flag, Check, Eye } from 'lucide-react'
import { PreviewDialog } from './preview-dialog'

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
  { id: 3, name: 'Images', path: '/images', icon: ImageIcon },
  { id: 4, name: 'Share', path: '/share', icon: Share2, optional: true },
  { id: 5, name: 'Upgrades', path: '/upgrades', icon: Sparkles },
  { id: 6, name: 'Review', path: '/review', icon: ClipboardCheck },
  { id: 7, name: 'Finalize', path: '/finalize', icon: Flag },
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
}

interface Company {
  logoUrl?: string | null
  companyName?: string | null
}

interface ReleaseOptions {
  advocacy?: boolean | null
}

interface Banner {
  url: string
  caption?: string | null
}

interface NewsImage {
  id: number
  url: string
  caption?: string | null
}

interface WizardNavProps {
  releaseUuid: string
  currentStep: number
  release?: Release
  company?: Company
  releaseOptions?: ReleaseOptions
  banner?: Banner | null
  images?: NewsImage[]
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
    case 3: // Images (News Images optional, Social Banner required)
      return !!release?.bannerId
    case 4: // Share
      return releaseOptions?.advocacy !== undefined
    case 5: // Upgrades
      return !!release?.distribution
    case 6: // Review
      return false // Review step is complete when user confirms
    case 7: // Finalize
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
  banner,
  images,
}: WizardNavProps) {
  const [showPreview, setShowPreview] = useState(false)

  return (
    <>
      <nav aria-label="Progress" className="mb-8">
        <ol className="flex items-center">
          {STEPS.map((step, stepIdx) => {
            const status = getStepStatus(step, currentStep, release, company, releaseOptions)
            const isComplete = isStepComplete(step, release, company, releaseOptions)
            const Icon = step.icon
            const href = step.path ? `/pr/${releaseUuid}${step.path}` : `/pr/${releaseUuid}`
            const isFinalizeStep = step.id === 7

            return (
              <li
                key={step.id}
                className={cn('relative', stepIdx !== STEPS.length - 1 && 'flex-1')}
              >
                {/* Preview icon above Finalize step */}
                {isFinalizeStep && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                    <button
                      onClick={() => setShowPreview(true)}
                      className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors"
                      title="Preview"
                      aria-label="Preview press release"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-center">
                  <Link
                    href={href}
                    className={cn(
                      'relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors',
                      status === 'completed' && 'bg-green-600 text-white hover:bg-green-700',
                      status === 'current' && 'bg-blue-600 text-white',
                      status === 'upcoming' && !step.optional && 'border-2 border-gray-300 bg-white text-gray-500 hover:border-gray-400',
                      status === 'upcoming' && step.optional && 'border-2 border-dashed border-gray-300 bg-white text-gray-400 hover:border-gray-400'
                    )}
                    title={`${step.name}${step.optional ? ' (Optional)' : ''}`}
                  >
                    {isComplete && status !== 'current' ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </Link>

                  {stepIdx !== STEPS.length - 1 && (
                    <div
                      className={cn(
                        'ml-4 h-0.5 w-full',
                        status === 'completed' ? 'bg-green-600' : 'bg-gray-200'
                      )}
                      aria-hidden="true"
                    />
                  )}
                </div>

                <span
                  className={cn(
                    'absolute -bottom-6 left-0 whitespace-nowrap text-xs font-medium',
                    status === 'current' && 'text-blue-600',
                    status === 'completed' && 'text-green-600',
                    status === 'upcoming' && 'text-gray-500'
                  )}
                >
                  {step.name}
                  {step.optional && <span className="text-gray-400 ml-0.5">*</span>}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="mt-10 text-xs text-gray-400">* Optional step</p>
      </nav>

      <PreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        release={release}
        company={company}
        banner={banner}
        images={images}
      />
    </>
  )
}

export { STEPS }
export type { WizardStep }
