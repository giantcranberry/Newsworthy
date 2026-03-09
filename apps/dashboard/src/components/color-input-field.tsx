"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  BlossomColorPicker,
  hexToHsl,
  lightnessToSliderValue,
  type BlossomColorPickerColor,
  type ColorInput,
  type SliderPosition,
} from "@dayflow/blossom-color-picker-react"
import "@dayflow/blossom-color-picker/styles.css"

const colorPalette: string[] = [
  // Layer 1: Outermost (12 Colors)
  "#E67700", "#D9480F", "#C92A2A", "#A61E4D", "#862E9C", "#5F3DC4",
  "#364FC7", "#1864AB", "#0B7285", "#087F5B", "#2B8A3E", "#5C940D",
  // Layer 2: Middle-Outer (12 Colors)
  "#FCC419", "#FF922B", "#FF6B6B", "#F06595", "#CC5DE8", "#845EF7",
  "#5C7CFA", "#339AF0", "#22B8CF", "#20C997", "#51CF66", "#94D82D",
  // Layer 3: Middle-Inner (12 Colors)
  "#FFE066", "#FFC078", "#FFA8A8", "#FCC2D7", "#E599F7", "#B197FC",
  "#91A7FF", "#74C0FC", "#66D9E8", "#63E6BE", "#8CE99A", "#C0EB75",
  // Layer 4: Pastels (6 Colors)
  "#FFF9DB", "#FFF5F5", "#F3D9FA", "#E7F5FF", "#E6FCF5", "#F4FCE3",
  // Layer 5: Neutrals — black, grays, white (8 Colors)
  "#000000", "#1a1a1a", "#404040", "#666666", "#999999", "#bfbfbf", "#e0e0e0", "#ffffff",
]

function hexToBlossomValue(hex: string) {
  if (!hex || !isValidHex(hex)) {
    return { hue: 220, saturation: 50, lightness: 50, originalSaturation: 50, alpha: 100, layer: "outer" as const }
  }
  try {
    const { h, s, l } = hexToHsl(hex)
    if (Number.isNaN(h) || Number.isNaN(s) || Number.isNaN(l)) {
      return { hue: 220, saturation: 50, lightness: 50, originalSaturation: 50, alpha: 100, layer: "outer" as const }
    }
    return {
      hue: h,
      saturation: lightnessToSliderValue(l),
      lightness: l,
      originalSaturation: s,
      alpha: 100,
      layer: "outer" as const,
    }
  } catch {
    return { hue: 220, saturation: 50, lightness: 50, originalSaturation: 50, alpha: 100, layer: "outer" as const }
  }
}

function isValidHex(hex: string) {
  return /^#[0-9a-fA-F]{6}$/.test(hex)
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function generateHuepalette(hex: string): string[] {
  const { h, s, l } = hexToHsl(hex)
  const colors: string[] = []

  const hueOffsets = [0, 30, -30, 60, -60, 120, -120, 150, -150, 180]

  for (const offset of hueOffsets) {
    const hue = (h + offset + 360) % 360
    colors.push(hslToHex(hue, Math.min(s + 10, 100), Math.max(l - 15, 20)))
    colors.push(hslToHex(hue, s, l))
    colors.push(hslToHex(hue, Math.max(s - 15, 20), Math.min(l + 20, 90)))
    colors.push(hslToHex(hue, Math.max(s - 30, 10), Math.min(l + 35, 95)))
  }

  colors.push("#000000", "#1a1a1a", "#404040", "#666666", "#999999", "#bfbfbf", "#e0e0e0", "#ffffff")

  return colors
}

export interface ColorInputFieldProps {
  label?: string
  value: string
  onChange: (value: string) => void
  colors?: ColorInput[]
  disabled?: boolean
}

export function ColorInputField({
  label,
  value,
  onChange,
  colors,
  disabled,
}: ColorInputFieldProps) {
  const blossomValue = useMemo(() => hexToBlossomValue(value), [value])

  const [isOpen, setIsOpen] = useState(false)
  const defaultColors = colors ?? colorPalette
  const [colorCount, setColorCount] = useState(50)
  const [customHex, setCustomHex] = useState("")
  const [customPalette, setCustomPalette] = useState<string[] | null>(null)
  const sourceColors = customPalette ?? defaultColors

  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const el = controlsRef.current
    if (!el) return
    const stop = (e: MouseEvent) => e.stopPropagation()
    el.addEventListener("mousedown", stop, true)
    return () => el.removeEventListener("mousedown", stop, true)
  })

  const dynamicPalette = useMemo(
    () => sourceColors.slice(0, colorCount),
    [sourceColors, colorCount]
  )

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const popupWidth = 360
    const popupHeight = 440
    let top = rect.bottom + 8
    let left = rect.left

    if (left + popupWidth > window.innerWidth - 16) {
      left = window.innerWidth - popupWidth - 16
    }
    if (left < 16) left = 16
    if (top + popupHeight > window.innerHeight - 16) {
      top = rect.top - popupHeight - 8
    }

    setPopupPos({ top, left })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const rafId = requestAnimationFrame(updatePosition)
    const scrollParent = triggerRef.current?.closest("[class*='overflow']") as HTMLElement | null
    const onScroll = () => updatePosition()
    window.addEventListener("resize", onScroll)
    scrollParent?.addEventListener("scroll", onScroll)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", onScroll)
      scrollParent?.removeEventListener("scroll", onScroll)
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen])

  const handleBlossomChange = (color: BlossomColorPickerColor) => {
    onChange(color.hex)
  }

  const decrement = useCallback(() => {
    setColorCount((prev) => Math.max(1, prev - 1))
  }, [])

  const increment = useCallback(() => {
    setColorCount((prev) => Math.min(sourceColors.length, prev + 1))
  }, [sourceColors.length])

  const handleCustomHex = useCallback(
    (input: string) => {
      setCustomHex(input)
      const normalized = input.startsWith("#") ? input : `#${input}`
      if (isValidHex(normalized)) {
        const palette = generateHuepalette(normalized)
        setCustomPalette(palette)
        setColorCount((prev) => Math.min(prev, palette.length))
        onChange(normalized)
      }
    },
    [onChange]
  )

  const clearCustomPalette = useCallback(() => {
    setCustomHex("")
    setCustomPalette(null)
    setColorCount(50)
  }, [])

  return (
    <div className="space-y-1">
      {label && <Label className="text-xs text-gray-500 dark:text-gray-400">{label}</Label>}
      <div className="flex items-center gap-2">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => {
            const opening = !isOpen
            setIsOpen(opening)
            if (opening) updatePosition()
          }}
          className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 cursor-pointer shrink-0 transition-shadow hover:shadow-md hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: isValidHex(value) ? value : "#ffffff" }}
          aria-label={label ? `Pick color for ${label}` : "Pick color"}
        />
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
          {value}
        </span>
      </div>

      {isOpen &&
        createPortal(
          <>
          <div
            className="fixed inset-0 z-[10010]"
            onClick={() => setIsOpen(false)}
          />
          <div
            ref={popupRef}
            className="fixed z-[10011] w-[360px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 px-4 py-3 animate-in fade-in zoom-in-95 duration-150"
            style={{ top: popupPos.top, left: popupPos.left }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                {label && <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</span>}
                <p className="text-xs text-gray-400">{colorCount} colors auto-distributed</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 text-xl leading-none hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 active:bg-gray-300 cursor-pointer transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Bloom picker */}
            <div
              className="flex items-center justify-center"
              style={{
                minHeight: 200,
                paddingTop: `${Math.round(8 + (colorCount / sourceColors.length) * 32)}px`,
                paddingBottom: `${Math.round(8 + (colorCount / sourceColors.length) * 32)}px`,
              }}
            >
              <BlossomColorPicker
                value={blossomValue}
                onChange={handleBlossomChange}
                colors={dynamicPalette}
                disabled={disabled}
                initialExpanded
                showAlphaSlider
                coreSize={24}
                petalSize={28}
                sliderPosition="right"
              />
            </div>

            <div
              ref={controlsRef}
              className="relative z-[1100] space-y-3"
            >
              {/* Color Count */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Color Count</span>
                <div className="flex items-center bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={decrement}
                    className="px-3 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:text-blue-600 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 rounded-md transition-colors cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-10 text-center text-sm font-mono text-gray-900 dark:text-gray-100">
                    {colorCount}
                  </span>
                  <button
                    type="button"
                    onClick={increment}
                    className="px-3 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:text-blue-600 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 rounded-md transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Custom hex input */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-gray-500">Custom Color</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5">
                    <span className="text-sm font-mono text-gray-500 mr-1">#</span>
                    <input
                      type="text"
                      value={customHex.replace(/^#/, "")}
                      onChange={(e) => handleCustomHex(e.target.value)}
                      placeholder="e.g. FF5733"
                      maxLength={7}
                      className="flex-1 bg-transparent text-sm font-mono text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400"
                    />
                  </div>
                  {customPalette && (
                    <button
                      type="button"
                      onClick={clearCustomPalette}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
                    >
                      Reset
                    </button>
                  )}
                </div>
                {customPalette && (
                  <p className="text-[10px] text-gray-400">
                    Showing complementary &amp; hue variations
                  </p>
                )}
              </div>

              {/* Selected color */}
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600"
                  style={{ backgroundColor: isValidHex(value) ? value : "#ffffff" }}
                />
                <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{value}</span>
              </div>
            </div>
          </div>
          </>,
          document.body
        )}
    </div>
  )
}
