import { db, eq, and, gte, lte, desc, releases } from '@/lib/db'
import { baseUrl, newsUrl, formatDateForSitemap } from '@/lib/utils'
import { getRecentArticles } from '@/lib/db/Articles'
import { slugify } from '@/lib/article_utils'

export const dynamic = 'force-dynamic'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const now = new Date()
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

  // /news and /curated do not overlap on this site — include both
  const [recentReleases, recentArticles] = await Promise.all([
    db.query.releases.findMany({
      columns: {
        id: true,
        title: true,
        slug: true,
        releasedAt: true,
        timezone: true,
      },
      where: and(
        eq(releases.isDeleted, false),
        eq(releases.isFeatured, true),
        lte(releases.releasedAt, now),
        gte(releases.releasedAt, fortyEightHoursAgo),
      ),
      orderBy: desc(releases.releasedAt),
    }),
    getRecentArticles(48),
  ])

  const prUrls = recentReleases
    .filter((r) => r.title && r.releasedAt && r.slug)
    .map((release) => ({
      loc: `${baseUrl}${newsUrl(release)}`,
      pubDate: formatDateForSitemap(release.releasedAt!, release.timezone || 'UTC'),
      title: release.title!,
      date: release.releasedAt!,
    }))

  const articleUrls = recentArticles
    .filter((a) => a.title && a.released_at)
    .map((article) => {
      const slug = slugify(article.title)
      const year = new Date(article.released_at).getFullYear()
      return {
        loc: `${baseUrl}/curated/${slug}/${year}${article.id}`,
        pubDate: formatDateForSitemap(new Date(article.released_at), 'UTC'),
        title: article.title,
        date: new Date(article.released_at),
      }
    })

  const allUrls = [...prUrls, ...articleUrls].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  )

  const entries = allUrls.map(
    (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>Newsworthy.ai</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${entry.pubDate}</news:publication_date>
      <news:title>${escapeXml(entry.title)}</news:title>
    </news:news>
  </url>`
  )

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${entries.join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
