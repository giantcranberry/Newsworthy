"use client"

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import type { TourDefinition, TourStep } from "@/lib/tour/types"
import { getTourById } from "@/lib/tour/tour-definitions"
import {
  getActiveTour,
  setActiveTour,
  clearActiveTour,
  markTourCompleted,
  hasBeenWelcomed,
  markWelcomed,
  getCompletedTours,
  hasFabHintBeenShown,
  markFabHintShown,
} from "@/lib/tour/tour-storage"
import { TourOverlay } from "./tour-overlay"
import { TourPopover } from "./tour-popover"
import { WelcomeDialog } from "./welcome-dialog"
import { FabHintDialog } from "./fab-hint-dialog"

interface TourContextValue {
  activeTour: TourDefinition | null
  currentStep: TourStep | null
  currentStepIndex: number
  totalSteps: number
  isActive: boolean
  startTour: (tourId: string) => void
  nextStep: () => void
  prevStep: () => void
  endTour: () => void
}

export const TourContext = createContext<TourContextValue | null>(null)

function findVisibleElement(target: string): Element | null {
  const all = document.querySelectorAll(`[data-tour="${target}"]`)
  for (const el of all) {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return el
  }
  return all[0] ?? null
}

function waitForElement(
  target: string,
  timeout = 5000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const el = findVisibleElement(target)
    if (el) return resolve(el)

    const observer = new MutationObserver(() => {
      const found = findVisibleElement(target)
      if (found) {
        observer.disconnect()
        resolve(found)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [tour, setTour] = useState<TourDefinition | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetElement, setTargetElement] = useState<Element | null>(null)
  const [searchFailed, setSearchFailed] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [showFabHint, setShowFabHint] = useState(false)

  const findTargetGenRef = useRef(0)

  const portalContainer = useMemo(
    () => (typeof document !== "undefined" ? document.body : null),
    []
  )

  const currentStep = tour?.steps[stepIndex] ?? null
  const isActive = tour !== null

  const resolveTourSteps = useCallback((def: TourDefinition): TourDefinition => {
    if (def.emptyTarget && def.emptySteps?.length) {
      const emptyEl = document.querySelector(`[data-tour="${def.emptyTarget}"]`)
      if (emptyEl) {
        return { ...def, steps: def.emptySteps }
      }
    }
    return def
  }, [])

  // Recover active tour from localStorage on mount
  useEffect(() => {
    if (tour) return

    const stored = getActiveTour()
    if (!stored) return

    const def = getTourById(stored.tourId)
    if (!def) {
      clearActiveTour()
      return
    }

    const id = requestAnimationFrame(() => {
      const resolved = resolveTourSteps(def)
      const safeIndex = Math.min(stored.stepIndex, resolved.steps.length - 1)
      setTour(resolved)
      setStepIndex(safeIndex)
    })
    return () => cancelAnimationFrame(id)
  }, [tour, resolveTourSteps])

  // Show welcome dialog for new users
  useEffect(() => {
    if (tour) return
    if (hasBeenWelcomed()) return
    if (getCompletedTours().length > 0) return
    if (getActiveTour()) return
    // Delay slightly so the page renders first
    const timer = setTimeout(() => setShowWelcome(true), 500)
    return () => clearTimeout(timer)
  }, [tour])

  // Show FAB hint after welcome is done and tour ends
  useEffect(() => {
    if (tour) return
    if (showWelcome) return
    if (!hasBeenWelcomed()) return
    if (hasFabHintBeenShown()) return
    const timer = setTimeout(() => setShowFabHint(true), 400)
    return () => clearTimeout(timer)
  }, [tour, showWelcome])

  // Find target element when step changes
  useEffect(() => {
    if (!tour) return

    const step = tour.steps[stepIndex] ?? null
    if (!step) return

    const gen = ++findTargetGenRef.current

    ;(async () => {
      setSearchFailed(false)
      const el = await waitForElement(step.target, 3000)

      if (gen !== findTargetGenRef.current) return

      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        await new Promise((r) => setTimeout(r, 300))

        if (gen !== findTargetGenRef.current) return

        setTargetElement(el)
      } else {
        setTargetElement(null)
        setSearchFailed(true)
      }
    })()

    return () => {
      findTargetGenRef.current++
    }
  }, [tour, stepIndex])

  const startTour = useCallback((tourId: string) => {
    const def = getTourById(tourId)
    if (!def) return

    const resolved = resolveTourSteps(def)
    setTour(resolved)
    setStepIndex(0)
    setTargetElement(null)
    setSearchFailed(false)
    setActiveTour(tourId, 0)
  }, [resolveTourSteps])

  const nextStep = useCallback(() => {
    if (!tour) return
    const newIndex = stepIndex + 1
    if (newIndex >= tour.steps.length) {
      markTourCompleted(tour.id)
      clearActiveTour()
      setTour(null)
      setStepIndex(0)
      setTargetElement(null)
      return
    }
    setStepIndex(newIndex)
    setTargetElement(null)
    setSearchFailed(false)
    setActiveTour(tour.id, newIndex)
  }, [tour, stepIndex])

  const prevStep = useCallback(() => {
    if (!tour || stepIndex <= 0) return
    const newIndex = stepIndex - 1
    setStepIndex(newIndex)
    setTargetElement(null)
    setSearchFailed(false)
    setActiveTour(tour.id, newIndex)
  }, [tour, stepIndex])

  const endTour = useCallback(() => {
    clearActiveTour()
    setTour(null)
    setStepIndex(0)
    setTargetElement(null)
    setSearchFailed(false)
  }, [])

  const handleFabHintDismiss = useCallback(() => {
    markFabHintShown()
    setShowFabHint(false)
  }, [])

  const handleWelcomeSkip = useCallback(() => {
    markWelcomed()
    setShowWelcome(false)
  }, [])

  const handleWelcomeStartTour = useCallback(() => {
    markWelcomed()
    setShowWelcome(false)
    startTour("dashboard")
  }, [startTour])

  const contextValue: TourContextValue = {
    activeTour: tour,
    currentStep,
    currentStepIndex: stepIndex,
    totalSteps: tour?.steps.length ?? 0,
    isActive,
    startTour,
    nextStep,
    prevStep,
    endTour,
  }

  const showPopover = targetElement !== null || searchFailed

  const tourUI =
    isActive && currentStep ? (
      <>
        <TourOverlay targetElement={targetElement} onClickOutside={endTour} />
        {showPopover && (
          <TourPopover
            step={currentStep}
            targetElement={targetElement}
            currentIndex={stepIndex}
            totalSteps={tour!.steps.length}
            onNext={nextStep}
            onPrev={prevStep}
            onClose={endTour}
          />
        )}
      </>
    ) : null

  return (
    <TourContext.Provider value={contextValue}>
      {children}
      {tourUI && portalContainer && createPortal(tourUI, portalContainer)}
      <WelcomeDialog
        open={showWelcome}
        onSkip={handleWelcomeSkip}
        onStartTour={handleWelcomeStartTour}
      />
      <FabHintDialog
        open={showFabHint}
        onDismiss={handleFabHintDismiss}
      />
    </TourContext.Provider>
  )
}
