'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(email)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors"
      title={copied ? 'Copied' : 'Copy email'}
      aria-label={copied ? 'Email copied' : `Copy ${email}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}
