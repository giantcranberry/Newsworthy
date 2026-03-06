'use client'

import ReactMarkdown from 'react-markdown'

interface MarkdownBodyProps {
  content: string
}

export function MarkdownBody({ content }: MarkdownBodyProps) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-a:text-sky-600 dark:prose-a:text-sky-400 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600 text-gray-700 dark:text-gray-300">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
