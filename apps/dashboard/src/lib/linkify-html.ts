/**
 * Convert plain-text URLs in HTML content into clickable <a> tags.
 * Skips URLs that are already inside an anchor tag's href or content.
 */
export function linkifyHtml(html: string): string {
  if (!html) return html

  // Split HTML into tags and text segments, then only linkify text segments
  const parts = html.split(/(<a\s[^>]*>.*?<\/a>|<[^>]+>)/gi)

  return parts
    .map((part) => {
      // Skip HTML tags and existing anchor elements
      if (part.startsWith('<')) return part

      // Replace plain URLs in text segments
      return part.replace(
        /\b(https?:\/\/[^\s<>"']+)/gi,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
      )
    })
    .join('')
}
