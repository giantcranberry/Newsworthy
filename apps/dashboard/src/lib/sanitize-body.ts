/**
 * Sanitize press release body HTML.
 *
 * Applies the following transformations:
 * 1. Downgrade headings: h1 → h2, h2 → h3 (body should use h3+ only)
 * 2. Ensure all href URLs start with https://
 * 3. Remove ### end-of-release markers
 * 4. Replace em-dash (—) and en-dash (–) with hyphen (-)
 */
export function sanitizeReleaseBody(html: string): string {
  let result = html

  // 1. Downgrade headings: h2→h3 first, then h1→h2 (order matters)
  result = result.replace(/<h2([^>]*)>/gi, '<h3$1>').replace(/<\/h2>/gi, '</h3>')
  result = result.replace(/<h1([^>]*)>/gi, '<h2$1>').replace(/<\/h1>/gi, '</h2>')

  // 2. Ensure all href URLs start with https://
  result = result.replace(/href="((?!https?:\/\/|mailto:|tel:|#)[^"]+)"/gi, (_, url) => {
    return `href="https://${url}"`
  })
  // Upgrade http:// to https://
  result = result.replace(/href="http:\/\//gi, 'href="https://')

  // 3. Remove ### end-of-release markers (in <p> tags or standalone)
  result = result.replace(/<p[^>]*>\s*#{1,3}\s*<\/p>/gi, '')
  result = result.replace(/<p[^>]*>\s*#\s+#\s+#\s*<\/p>/gi, '')
  result = result.replace(/\s*#{3}\s*/g, '')
  result = result.replace(/\s*#\s+#\s+#\s*/g, '')

  // 4. Replace em-dash and en-dash with hyphen
  result = result.replace(/[—–]/g, '-')

  return result
}
