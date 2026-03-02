"use client"

import { useContext } from "react"
import { TourContext } from "@/components/tour/tour-provider"

export function useTour() {
  const context = useContext(TourContext)
  if (!context) {
    return {
      activeTour: null,
      currentStep: null,
      currentStepIndex: 0,
      totalSteps: 0,
      isActive: false,
      startTour: () => {},
      nextStep: () => {},
      prevStep: () => {},
      endTour: () => {},
    }
  }
  return context
}
