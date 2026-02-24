import { Skeleton } from '@/components/ui/skeleton'

function WizardNavSkeleton() {
  return (
    <nav className="mb-8">
      <div className="flex items-center">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={i < 6 ? 'flex-1' : ''}>
            <div className="flex items-center">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              {i < 6 && <Skeleton className="h-0.5 w-full" />}
            </div>
          </div>
        ))}
      </div>
    </nav>
  )
}

function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-56" />
        </div>
      </div>
      <div className="space-y-3 pt-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-4"
            style={{ width: `${85 - i * 10}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function WizardStepSkeleton({
  cards = 1,
  lines,
}: {
  cards?: number
  lines?: number
}) {
  return (
    <div className="space-y-6">
      {/* Sticky header skeleton */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 -mx-6 px-6 py-4 -mt-6 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        </div>
      </div>

      {/* Wizard nav skeleton */}
      <WizardNavSkeleton />

      {/* Card skeletons */}
      {Array.from({ length: cards }).map((_, i) => (
        <CardSkeleton key={i} lines={lines} />
      ))}
    </div>
  )
}
