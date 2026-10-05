import sanitizeHtml from 'sanitize-html'

/**
 * Sanitize press release body HTML.
 *
 * Applies the following transformations:
 * 1. Downgrade headings: h1 → h2, h2 → h3 (body should use h3+ only)
 * 2. Ensure all href URLs start with https://
 * 3. Remove ### end-of-release markers
 * 4. Remove horizontal rules (--- and <hr> tags)
 * 5. Replace em-dash (—) and en-dash (–) with hyphen (-)
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

  // 4. Remove horizontal rules (<hr> tags and --- in <p> tags)
  result = result.replace(/<hr\s*\/?>/gi, '')
  result = result.replace(/<p[^>]*>\s*-{3,}\s*<\/p>/gi, '')

  // 5. Replace em-dash and en-dash with hyphen
  result = result.replace(/[—–]/g, '-')

  return result
}

// sanitize-html transform marking a link rel="nofollow". Press release links
// are user submitted and must never pass link equity; any other rel tokens
// the author set (noopener, sponsored, ...) are kept.
export function nofollowLink(tagName: string, attribs: Record<string, string>) {
  const rel = new Set((attribs.rel || '').toLowerCase().split(/\s+/).filter(Boolean))
  rel.add('nofollow')
  return { tagName, attribs: { ...attribs, rel: Array.from(rel).join(' ') } }
}

// Add rel="nofollow" to every link in user-submitted HTML, leaving all other
// markup exactly as it was.
export function nofollowLinks(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: false,
    allowedAttributes: false,
    allowVulnerableTags: true,
    transformTags: { a: nofollowLink },
  })
}
