'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function RssFeedLink({ companyUuid }: { companyUuid: string }) {
  const [copied, setCopied] = useState(false)
  const feedUrl = `https://app.newsworthy.ai/feeds/company/${companyUuid.replace(/-/g, '')}/latest.rss`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(feedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-gray-500">
      <span className="font-medium text-gray-600">Press Release RSS Feed:</span>
      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 truncate max-w-xs">
        {feedUrl}
      </code>
      <button
        onClick={handleCopy}
        className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
        title="Copy RSS feed URL"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}
