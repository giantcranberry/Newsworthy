'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface ResizeHandleProps {
  onResize: (delta: number) => void
  onResizeEnd?: () => void
}

export function ResizeHandle({ onResize, onResizeEnd }: ResizeHandleProps) {
  const isDragging = useRef(false)
  const [active, setActive] = useState(false)
  const lastX = useRef(0)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return
    const delta = lastX.current - e.clientX
    lastX.current = e.clientX
    onResize(delta)
  }, [onResize])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    setActive(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    onResizeEnd?.()
  }, [onResizeEnd])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    setActive(true)
    lastX.current = e.clientX
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute left-0 top-0 bottom-0 w-6 -ml-3 cursor-col-resize z-10 group flex items-center justify-center"
    >
      {/* Full-height hover/active highlight line — sits on the panel border */}
      <div
        className={`absolute inset-y-0 left-[10px] w-[3px] rounded-full transition-colors duration-150 ${
          active ? 'bg-cyan-600' : 'bg-transparent group-hover:bg-cyan-400/60'
        }`}
      />
      {/* Center pill handle — positioned on the panel's left edge */}
      <div
        className={`relative z-10 ml-1 flex flex-col items-center justify-center gap-[3px] w-4 h-10 rounded-full border transition-all duration-150 ${
          active
            ? 'bg-cyan-600 border-cyan-600 shadow-md'
            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-sm group-hover:border-cyan-400 group-hover:shadow-md'
        }`}
      >
        <span className={`block w-[3px] h-[3px] rounded-full ${active ? 'bg-white' : 'bg-gray-400 group-hover:bg-cyan-500'}`} />
        <span className={`block w-[3px] h-[3px] rounded-full ${active ? 'bg-white' : 'bg-gray-400 group-hover:bg-cyan-500'}`} />
        <span className={`block w-[3px] h-[3px] rounded-full ${active ? 'bg-white' : 'bg-gray-400 group-hover:bg-cyan-500'}`} />
      </div>
    </div>
  )
}
