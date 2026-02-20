'use client'

import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'

interface HelpTipProps {
  title: string
  content: string
}

export function HelpTip({ title, content }: HelpTipProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-cyan-800 hover:text-cyan-800 cursor-pointer"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        Tips
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-medium text-gray-900">{title}</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {content}
            </div>
            <div className="flex justify-end p-4 border-t border-gray-100">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
