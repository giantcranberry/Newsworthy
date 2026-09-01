/** Case-insensitive blocklist matching against release text fields. */

export type ReleaseBlocklistFields = {
  title?: string | null
  abstract?: string | null
  body?: string | null
  pullquote?: string | null
  location?: string | null
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function releaseTextForBlocklist(fields: ReleaseBlocklistFields): string {
  return [
    fields.title,
    fields.abstract,
    fields.body ? stripHtml(fields.body) : null,
    fields.pullquote,
    fields.location,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}

/** Returns blocklist terms found in the release (original casing preserved). */
export function findBlockedTerms(
  fields: ReleaseBlocklistFields,
  terms: string[],
): string[] {
  if (!terms.length) return []
  const haystack = releaseTextForBlocklist(fields)
  if (!haystack) return []

  const found: string[] = []
  for (const term of terms) {
    const needle = term.trim().toLowerCase()
    if (!needle) continue
    if (haystack.includes(needle)) {
      found.push(term)
    }
  }
  return found
}
