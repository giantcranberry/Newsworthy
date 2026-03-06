import type { TourActiveState } from "./types"

const COMPLETED_KEY = "newsworthy-tour-completed"
const ACTIVE_KEY = "newsworthy-tour-active"
const WELCOMED_KEY = "newsworthy-tour-welcomed"
const FAB_HINT_KEY = "newsworthy-tour-fab-hint"

export function getCompletedTours(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(COMPLETED_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function isTourCompleted(tourId: string): boolean {
  return getCompletedTours().includes(tourId)
}

export function markTourCompleted(tourId: string): void {
  if (typeof window === "undefined") return
  const completed = getCompletedTours()
  if (!completed.includes(tourId)) {
    completed.push(tourId)
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(completed))
  }
}

export function getActiveTour(): TourActiveState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setActiveTour(tourId: string, stepIndex: number): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ACTIVE_KEY, JSON.stringify({ tourId, stepIndex }))
}

export function clearActiveTour(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(ACTIVE_KEY)
}

export function hasBeenWelcomed(): boolean {
  if (typeof window === "undefined") return true
  return localStorage.getItem(WELCOMED_KEY) === "true"
}

export function markWelcomed(): void {
  if (typeof window === "undefined") return
  localStorage.setItem(WELCOMED_KEY, "true")
}

export function hasFabHintBeenShown(): boolean {
  if (typeof window === "undefined") return true
  return localStorage.getItem(FAB_HINT_KEY) === "true"
}

export function markFabHintShown(): void {
  if (typeof window === "undefined") return
  localStorage.setItem(FAB_HINT_KEY, "true")
}

export function resetTourProgress(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(COMPLETED_KEY)
  localStorage.removeItem(ACTIVE_KEY)
}
