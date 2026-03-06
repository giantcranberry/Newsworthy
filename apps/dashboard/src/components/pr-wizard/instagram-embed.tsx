'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } }
  }
}

export function InstagramEmbed({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!document.querySelector('script[src*="instagram.com/embed.js"]')) {
      const script = document.createElement('script')
      script.src = '//www.instagram.com/embed.js'
      script.async = true
      document.body.appendChild(script)
    } else if (window.instgrm) {
      window.instgrm.Embeds.process()
    }
  }, [url])

  return (
    <div ref={ref} className="flex justify-center">
      <blockquote
        className="instagram-media"
        data-instgrm-captioned
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{ maxWidth: 540, width: '100%' }}
      >
        <a href={url} target="_blank" rel="noopener noreferrer">
          View on Instagram
        </a>
      </blockquote>
    </div>
  )
}
