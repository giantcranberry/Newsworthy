const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
export const INDEXNOW_SITE_ORIGIN = 'https://www.newsworthy.ai'

function getIndexNowKey(): string | undefined {
  return process.env.INDEXNOW_API_KEY || undefined
}

/**
 * Build the canonical public news URL for a press release.
 */
export function buildIndexNowReleaseUrl(release: {
  releaseAt: Date | string | null
  id: number
  slug: string | null
}): string | null {
  if (!release.releaseAt || !release.slug) return null
  const d = new Date(release.releaseAt)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${INDEXNOW_SITE_ORIGIN}/news/${y}${m}${day}${release.id}/${release.slug}`
}

/**
 * Submit changed URLs to IndexNow (Bing and other participating engines).
 * Failures are logged and never thrown — publishing must not depend on IndexNow.
 */
export async function submitToIndexNow(
  urls: string[]
): Promise<{ ok: boolean; status?: number; submitted: number }> {
  const key = getIndexNowKey()
  if (!key) {
    console.warn('IndexNow: INDEXNOW_API_KEY is not set; skipping submission')
    return { ok: false, submitted: 0 }
  }

  const uniqueUrls = [...new Set(urls.filter(Boolean))]
  if (uniqueUrls.length === 0) return { ok: true, submitted: 0 }

  const host = new URL(INDEXNOW_SITE_ORIGIN).host
  const owned = uniqueUrls.filter((u) => {
    try {
      return new URL(u).host === host
    } catch {
      return false
    }
  })
  if (owned.length === 0) return { ok: true, submitted: 0 }

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${INDEXNOW_SITE_ORIGIN}/${key}.txt`,
        urlList: owned,
      }),
    })

    if (res.status !== 200 && res.status !== 202) {
      const body = await res.text().catch(() => '')
      console.error(`IndexNow: submission failed (${res.status})`, body.slice(0, 500))
      return { ok: false, status: res.status, submitted: 0 }
    }

    return { ok: true, status: res.status, submitted: owned.length }
  } catch (error) {
    console.error('IndexNow: submission error', error)
    return { ok: false, submitted: 0 }
  }
}

/** Fire-and-forget wrapper so callers don't await IndexNow. */
export function queueIndexNowUrls(urls: Array<string | null | undefined>): void {
  const cleaned = urls.filter((u): u is string => Boolean(u))
  if (cleaned.length === 0) return
  void submitToIndexNow(cleaned).catch((error) => {
    console.error('IndexNow: unexpected error', error)
  })
}

export function queueIndexNowForRelease(release: {
  releaseAt: Date | string | null
  id: number
  slug: string | null
}): void {
  queueIndexNowUrls([buildIndexNowReleaseUrl(release)])
}
