'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronDown } from 'lucide-react'

interface Option {
  value: number
  label: string
}

interface MultiSelectProps {
  options: Option[]
  selected: number[]
  onChange: (selected: number[]) => void
  placeholder?: string
  maxItems?: number
  className?: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select...',
  maxItems,
  className = '',
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current && !containerRef.current.contains(target)) {
        // Also check if click is inside the dropdown portal
        const dropdown = document.getElementById('multiselect-dropdown')
        if (dropdown && dropdown.contains(target)) {
          return
        }
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      })
      // Focus the input when dropdown opens
      inputRef.current?.focus()
    }
  }, [isOpen])

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  )

  const selectedOptions = options.filter(opt => selected.includes(opt.value))

  const toggleOption = (value: number) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else if (!maxItems || selected.length < maxItems) {
      onChange([...selected, value])
    }
    setSearch('')
    inputRef.current?.focus()
  }

  const removeOption = (value: number, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selected.filter(v => v !== value))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && search === '' && selected.length > 0) {
      // Remove last selected item when pressing backspace with empty search
      onChange(selected.slice(0, -1))
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setSearch('')
    } else if (e.key === 'Enter' && filteredOptions.length === 1) {
      // Select the only matching option on Enter
      e.preventDefault()
      toggleOption(filteredOptions[0].value)
    }
  }

  const dropdown = (
    <div id="multiselect-dropdown" style={dropdownStyle} className="bg-white border border-gray-200 rounded-md shadow-lg">
      <div className="max-h-64 overflow-y-auto">
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-600">No results found</div>
        ) : (
          filteredOptions.map(opt => {
            const isSelected = selected.includes(opt.value)
            const isDisabled = !isSelected && maxItems !== undefined && selected.length >= maxItems
            return (
              <div
                key={opt.value}
                onClick={() => !isDisabled && toggleOption(opt.value)}
                className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-gray-50 text-cyan-800'
                    : isDisabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => {}}
                  className="rounded border-gray-300"
                />
                {opt.label}
              </div>
            )
          })
        )}
      </div>
      {maxItems && (
        <div className="px-3 py-2 text-xs text-gray-600 border-t border-gray-100">
          {selected.length}/{maxItems} selected
        </div>
      )}
    </div>
  )

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        onClick={() => {
          setIsOpen(true)
          inputRef.current?.focus()
        }}
        className="min-h-[38px] w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 cursor-text flex items-center gap-2"
      >
        <div className="flex-1 flex flex-wrap gap-1 items-center">
          {selectedOptions.map(opt => (
            <span
              key={opt.value}
              className="inline-flex items-center gap-1 bg-cyan-800/10 text-cyan-800 px-2 py-0.5 rounded text-xs"
            >
              {opt.label}
              <X
                className="h-3 w-3 cursor-pointer hover:text-cyan-800"
                onClick={(e) => removeOption(opt.value, e)}
              />
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              if (!isOpen) setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedOptions.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[60px] outline-none bg-transparent text-sm"
          />
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && mounted && createPortal(dropdown, document.body)}
    </div>
  )
}
