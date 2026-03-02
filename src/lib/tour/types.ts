export type TourStepPosition = "top" | "bottom" | "left" | "right"

export interface TourStep {
  id: string
  target: string
  title: string
  description: string
  position: TourStepPosition
}

export interface TourDefinition {
  id: string
  name: string
  description: string
  steps: TourStep[]
  emptyTarget?: string
  emptySteps?: TourStep[]
}

export interface TourActiveState {
  tourId: string
  stepIndex: number
}
