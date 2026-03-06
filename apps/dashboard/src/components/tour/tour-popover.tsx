"use client"

import { useEffect, useMemo, useState } from "react"
import { X, ArrowLeft, ChevronRight } from "lucide-react"
import type { TourStep, TourStepPosition } from "@/lib/tour/types"

const GAP = 12
const VIEWPORT_PADDING = 16

function findScrollParent(el: Element): Element | null {
  let parent = el.parentElement
  while (parent && parent !== document.body) {
    const { overflowY } = getComputedStyle(parent)
    if (overflowY === "auto" || overflowY === "scroll") return parent
    parent = parent.parentElement
  }
  return null
}

function findStickyHeader(scrollParent: Element): Element | null {
  const els = scrollParent.getElementsByTagName("*")
  for (let i = 0; i < Math.min(els.length, 50); i++) {
    if (getComputedStyle(els[i]).position === "sticky") return els[i]
  }
  return null
}

function getVisibleRect(
  el: Element,
  scrollParent: Element | null,
  stickyHeader: Element | null
): DOMRect {
  const raw = el.getBoundingClientRect()
  let clipTop = 0
  let clipBottom = window.innerHeight
  let clipLeft = 0
  let clipRight = window.innerWidth

  if (scrollParent) {
    const sp = scrollParent.getBoundingClientRect()
    clipTop = sp.top
    clipBottom = sp.bottom
    clipLeft = sp.left
    clipRight = sp.right
  }

  if (stickyHeader && !stickyHeader.contains(el)) {
    const sh = stickyHeader.getBoundingClientRect()
    if (sh.top <= clipTop + 10) {
      clipTop = Math.max(clipTop, sh.bottom)
    }
  }

  const x = Math.max(raw.left, clipLeft)
  const y = Math.max(raw.top, clipTop)
  const w = Math.max(0, Math.min(raw.right, clipRight) - x)
  const h = Math.max(0, Math.min(raw.bottom, clipBottom) - y)

  return new DOMRect(x, y, w, h)
}

interface TourPopoverProps {
  step: TourStep
  targetElement: Element | null
  currentIndex: number
  totalSteps: number
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

function getPosition(
  targetRect: DOMRect,
  preferred: TourStepPosition
): { top: number; left: number; actualPosition: TourStepPosition } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const popW = Math.min(400, vw * 0.9)
  const popH = 260

  const visTop = Math.max(targetRect.top, 0)
  const visBottom = Math.min(targetRect.bottom, vh)
  const visLeft = Math.max(targetRect.left, 0)
  const visRight = Math.min(targetRect.right, vw)

  const cx = (visLeft + visRight) / 2
  const cy = (visTop + visBottom) / 2

  const positions: Record<
    TourStepPosition,
    { top: number; left: number; fits: boolean }
  > = {
    bottom: {
      top: visBottom + GAP,
      left: cx - popW / 2,
      fits: visBottom + GAP + popH + VIEWPORT_PADDING <= vh,
    },
    top: {
      top: visTop - GAP - popH,
      left: cx - popW / 2,
      fits: visTop - GAP - popH >= VIEWPORT_PADDING,
    },
    right: {
      top: cy - popH / 2,
      left: targetRect.right + GAP,
      fits: targetRect.right + GAP + popW + VIEWPORT_PADDING <= vw,
    },
    left: {
      top: cy - popH / 2,
      left: targetRect.left - GAP - popW,
      fits: targetRect.left - GAP - popW >= VIEWPORT_PADDING,
    },
  }

  const opposite: Record<TourStepPosition, TourStepPosition> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  }

  let chosen = preferred
  if (!positions[preferred].fits) {
    if (positions[opposite[preferred]].fits) {
      chosen = opposite[preferred]
    } else {
      const fallback = (
        ["right", "left", "bottom", "top"] as TourStepPosition[]
      ).find((p) => positions[p].fits)
      if (fallback) chosen = fallback
    }
  }

  let { top, left } = positions[chosen]
  left = Math.max(VIEWPORT_PADDING, Math.min(left, vw - popW - VIEWPORT_PADDING))
  top = Math.max(VIEWPORT_PADDING, Math.min(top, vh - popH - VIEWPORT_PADDING))

  return { top, left, actualPosition: chosen }
}

export function TourPopover({
  step,
  targetElement,
  currentIndex,
  totalSteps,
  onNext,
  onPrev,
  onClose,
}: TourPopoverProps) {
  const [fadeIn, setFadeIn] = useState(false)
  const [, setTick] = useState(0)

  const scrollParent = useMemo(
    () => (targetElement ? findScrollParent(targetElement) : null),
    [targetElement]
  )
  const stickyHeader = useMemo(
    () => (scrollParent ? findStickyHeader(scrollParent) : null),
    [scrollParent]
  )

  useEffect(() => {
    const resetId = requestAnimationFrame(() => setFadeIn(false))
    const t = setTimeout(() => setFadeIn(true), 80)
    return () => {
      cancelAnimationFrame(resetId)
      clearTimeout(t)
    }
  }, [step.id, targetElement])

  useEffect(() => {
    let rafId: number
    const handleUpdate = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => setTick((t) => t + 1))
    }
    window.addEventListener("resize", handleUpdate)
    window.addEventListener("scroll", handleUpdate, true)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", handleUpdate)
      window.removeEventListener("scroll", handleUpdate, true)
    }
  }, [])

  let top: number
  let left: number
  let arrowStyle: React.CSSProperties | null = null

  if (targetElement) {
    const targetRect = getVisibleRect(targetElement, scrollParent, stickyHeader)
    if (targetRect.width === 0 && targetRect.height === 0) {
      top = Math.max(16, (window.innerHeight - 260) / 2)
      left = Math.max(
        16,
        (window.innerWidth - Math.min(400, window.innerWidth * 0.9)) / 2
      )
    } else {
      const pos = getPosition(targetRect, step.position)
      top = pos.top
      left = pos.left

      const vh = window.innerHeight
      const vw = window.innerWidth
      const visTop = Math.max(targetRect.top, 0)
      const visBottom = Math.min(targetRect.bottom, vh)
      const visLeft = Math.max(targetRect.left, 0)
      const visRight = Math.min(targetRect.right, vw)
      const cx = (visLeft + visRight) / 2
      const cy = (visTop + visBottom) / 2

      arrowStyle = {
        position: "absolute",
        width: 14,
        height: 14,
        transform: "rotate(45deg)",
        zIndex: 1,
      }

      if (pos.actualPosition === "bottom") {
        Object.assign(arrowStyle, {
          top: -7,
          left: Math.max(16, Math.min(cx - left, 400 - 16)) - 7,
          borderLeft: "1px solid var(--tour-arrow-border, rgba(0,0,0,0.05))",
          borderTop: "1px solid var(--tour-arrow-border, rgba(0,0,0,0.05))",
        })
      } else if (pos.actualPosition === "top") {
        Object.assign(arrowStyle, {
          bottom: -7,
          left: Math.max(16, Math.min(cx - left, 400 - 16)) - 7,
          borderRight: "1px solid var(--tour-arrow-border, rgba(0,0,0,0.05))",
          borderBottom: "1px solid var(--tour-arrow-border, rgba(0,0,0,0.05))",
        })
      } else if (pos.actualPosition === "right") {
        Object.assign(arrowStyle, {
          left: -7,
          top: Math.max(16, Math.min(cy - top, 260 - 16)) - 7,
          borderBottom: "1px solid var(--tour-arrow-border, rgba(0,0,0,0.05))",
          borderLeft: "1px solid var(--tour-arrow-border, rgba(0,0,0,0.05))",
        })
      } else {
        Object.assign(arrowStyle, {
          right: -7,
          top: Math.max(16, Math.min(cy - top, 260 - 16)) - 7,
          borderTop: "1px solid var(--tour-arrow-border, rgba(0,0,0,0.05))",
          borderRight: "1px solid var(--tour-arrow-border, rgba(0,0,0,0.05))",
        })
      }
    }
  } else {
    top = Math.max(16, (window.innerHeight - 260) / 2)
    left = Math.max(
      16,
      (window.innerWidth - Math.min(400, window.innerWidth * 0.9)) / 2
    )
  }

  const isFirst = currentIndex === 0
  const isLast = currentIndex === totalSteps - 1

  return (
    <div
      className="bg-white dark:bg-gray-900 border border-transparent dark:border-gray-700"
      style={{
        position: "fixed",
        top,
        left,
        zIndex: 10001,
        width: 400,
        maxWidth: "90vw",
        borderRadius: 16,
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
        overflow: "visible",
        pointerEvents: "auto",
        opacity: fadeIn ? 1 : 0,
        transform: fadeIn ? "scale(1)" : "scale(0.97)",
        transition: "opacity 200ms ease, transform 200ms ease",
      }}
      role="dialog"
      aria-label={`Tour step ${currentIndex + 1} of ${totalSteps}`}
    >
      {arrowStyle && <div className="bg-white dark:bg-gray-900" style={arrowStyle} />}

      <div style={{ borderRadius: 16, overflow: "hidden" }}>
        {/* Progress + close */}
        <div className="px-6 pt-5 pb-1">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold text-cyan-800 dark:text-cyan-400 uppercase tracking-wider">
              Step {currentIndex + 1} of {totalSteps}
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-400 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
            <div
              className="bg-cyan-700 h-1.5 rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${((currentIndex + 1) / totalSteps) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Title + description */}
        <div className="px-6 pt-4 pb-5">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-tight">
            {step.title}
          </h3>
          <p className="mt-2.5 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onClose}
            className="text-sm text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={onPrev}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
            <button
              onClick={onNext}
              className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-white bg-cyan-800 dark:bg-cyan-600 rounded-lg hover:bg-cyan-900 dark:hover:bg-cyan-700 transition-colors cursor-pointer"
            >
              {isLast ? "Finish" : "Next"}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
