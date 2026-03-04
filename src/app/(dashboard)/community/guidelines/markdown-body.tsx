'use client'

import ReactMarkdown from 'react-markdown'

interface MarkdownBodyProps {
  content: string
}

export function MarkdownBody({ content }: MarkdownBodyProps) {
  return (
    <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
