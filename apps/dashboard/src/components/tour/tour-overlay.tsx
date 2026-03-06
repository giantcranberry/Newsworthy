"use client"

import { useEffect, useState, useCallback, useRef } from "react"

interface TourOverlayProps {
  targetElement: Element | null
  onClickOutside: () => void
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const PADDING = 6
const BORDER_RADIUS = 8

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
): Rect {
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
  const width = Math.max(0, Math.min(raw.right, clipRight) - x)
  const height = Math.max(0, Math.min(raw.bottom, clipBottom) - y)

  return { x, y, width, height }
}

export function TourOverlay({ targetElement, onClickOutside }: TourOverlayProps) {
  const [rect, setRect] = useState<Rect | null>(null)
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })

  const scrollParentRef = useRef<Element | null>(null)
  const stickyHeaderRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!targetElement) {
      scrollParentRef.current = null
      stickyHeaderRef.current = null
      return
    }
    const sp = findScrollParent(targetElement)
    scrollParentRef.current = sp
    stickyHeaderRef.current = sp ? findStickyHeader(sp) : null
  }, [targetElement])

  const updateRect = useCallback(() => {
    if (typeof window !== "undefined") {
      setViewportSize({ w: window.innerWidth, h: window.innerHeight })
    }
    if (!targetElement) {
      setRect(null)
      return
    }
    setRect(
      getVisibleRect(targetElement, scrollParentRef.current, stickyHeaderRef.current)
    )
  }, [targetElement])

  useEffect(() => {
    const initId = requestAnimationFrame(updateRect)

    let rafId: number
    const handleUpdate = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(updateRect)
    }

    window.addEventListener("resize", handleUpdate)
    window.addEventListener("scroll", handleUpdate, true)

    return () => {
      cancelAnimationFrame(initId)
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", handleUpdate)
      window.removeEventListener("scroll", handleUpdate, true)
    }
  }, [updateRect])

  if (viewportSize.w === 0) return null

  if (!rect) {
    return (
      <svg
        style={{ position: "fixed", inset: 0, zIndex: 10000, pointerEvents: "none" }}
        width={viewportSize.w}
        height={viewportSize.h}
      >
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.45)"
          style={{ pointerEvents: "auto", cursor: "default" }}
          onClick={onClickOutside}
        />
      </svg>
    )
  }

  const cutX = rect.x - PADDING
  const cutY = rect.y - PADDING
  const cutW = rect.width + PADDING * 2
  const cutH = rect.height + PADDING * 2

  return (
    <svg
      style={{ position: "fixed", inset: 0, zIndex: 10000, pointerEvents: "none" }}
      width={viewportSize.w}
      height={viewportSize.h}
    >
      <defs>
        <mask id="tour-spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={cutX}
            y={cutY}
            width={Math.max(cutW, 0)}
            height={Math.max(cutH, 0)}
            rx={BORDER_RADIUS}
            fill="black"
          />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0, 0, 0, 0.45)"
        mask="url(#tour-spotlight-mask)"
        style={{ pointerEvents: "auto", cursor: "default" }}
        onClick={onClickOutside}
      />
      <rect
        x={cutX}
        y={cutY}
        width={Math.max(cutW, 0)}
        height={Math.max(cutH, 0)}
        rx={BORDER_RADIUS}
        fill="none"
        stroke="rgba(21, 94, 117, 0.6)"
        strokeWidth="2"
        style={{ pointerEvents: "none" }}
      />
    </svg>
  )
}
