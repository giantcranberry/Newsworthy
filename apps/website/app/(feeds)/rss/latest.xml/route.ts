import { db, eq, and, or, gt, lte, desc, releases } from '@/lib/db';
import { baseUrl, newsUrl } from '@/lib/utils';
import RSS from 'rss';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // once an hour

function getCategoryNames(categories: Array<{ category?: { name?: string } | null }>) {
  return categories
    .map(cat => cat.category?.name)
    .filter((name): name is string => typeof name === 'string');
}

export async function GET(request: Request) {
    const currentDatetime = new Date();
    const oneHourAgo = new Date(currentDatetime.getTime() - 3600 * 1000);

    const feed = new RSS({
        title: 'NewsWorthy.ai Press Releases',
        description: 'Latest featured press releases from NewsWorthy.ai',
        feed_url: `${baseUrl}/rss/latest.xml`,
        site_url: baseUrl,
        image_url: `${baseUrl}/logo.png`,
        webMaster: 'support@newsworthy.ai',
        managingEditor: 'admin@mail.newsworthy.ai',
        generator: 'NewsWorthy.ai RSS Feed',
        language: 'en',
        pubDate: currentDatetime,
        ttl: 60,
        custom_namespaces: {
            'content': 'http://purl.org/rss/1.0/modules/content/'
        }
    });

    const current_releases = await db.query.releases.findMany({
        limit: 25,
        columns: {
            id: true,
            title: true,
            selfHost: true,
            companyId: true,
            userId: true,
            slug: true,
            releasedAt: true,
            timezone: true,
            body: true,
            status: true,
            abstract: true,
            isFeatured: true,
            score: true,
        },
        with: {
            releaseCategories: {
                with: {
                    category: {
                        columns: { name: true }
                    }
                }
            },
            banner: {
                columns: { cdnUrl: true }
            }
        },
        where: and(
            eq(releases.isDeleted, false),
            eq(releases.isFeatured, true),
            or(
                and(
                    lte(releases.releasedAt, currentDatetime),
                    gt(releases.score, 3)
                ),
                and(
                    gt(releases.releasedAt, oneHourAgo),
                    lte(releases.releasedAt, currentDatetime),
                    eq(releases.score, 3)
                )
            )
        ),
        orderBy: desc(releases.releasedAt),
    });

    current_releases.forEach(release => {
        feed.item({
            title: release.title!,
            description: release.abstract ?? release.body!,
            url: `${baseUrl}${newsUrl(release)}`,
            guid: `${baseUrl}${newsUrl(release)}`,
            categories: getCategoryNames(release.releaseCategories),
            date: release.releasedAt!,
            custom_elements: [
                { 'content:encoded': release.body },
                release.banner?.cdnUrl ?
                    { 'media:content': { _attr: {
                        url: release.banner.cdnUrl,
                        medium: 'image'
                    }}} : null
            ].filter(Boolean)
        });
    });

    const xml = feed.xml({ indent: true });
    const styledXml = xml.replace(
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href="/rss-style.xsl"?>'
    );

    return new Response(styledXml, {
        headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'max-age=3600, public'
        }
    });
}
