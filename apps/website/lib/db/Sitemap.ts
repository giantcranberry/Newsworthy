import { getPool } from "@/lib/neon";

export type ReleaseMonths = {
    year: number;
    month: number;
    language_code: string;
};

export type SiteMapData = {
    site_handle: string;
    link: string;
    headline: string;
    language: string;
    newsramp_curated?: string | null; 
    published: Date;
    md5_permalink: string;
};

export async function getReleaseMonths(): Promise<ReleaseMonths[] > {

    const query = `
        SELECT
            EXTRACT(YEAR FROM f.published) as year,
            EXTRACT(MONTH FROM f.published) as month,
            r.language
        FROM releases r
        JOIN feeditem f ON r.feed_item_id = f.id
        WHERE
            f.deleted_at IS NULL
            AND r.feed_item_id NOT IN (SELECT feed_item_id FROM moderated)
        GROUP BY r.language, year, month
        ORDER BY r.language ASC, year DESC, month DESC;
    `;

    let client;

    try {
        client = await getPool().connect();
        const { rows } = await client.query(query);
        client.release();
        return rows.map((row: any) => ({
            year: row.year,
            month: row.month,
            language_code: row.language
        }));
    } catch (error) {
        console.error(error);
        if (client && typeof client.release === "function") {
            client.release();
        }
        return [];
    }
}

// https://newsramp.com/news/24-7PressRelease/en/creta-class-revolutionizes-early-mathematics-education-with-groundbreaking-research-findings/3c6772398b135e1fa28a4f249d71fa98
// https://newsramp.com/curated-news/creta-class-reveals-groundbreaking-research-findings-on-children-s-learning-behaviors-in-four-asian-countries/3c6772398b135e1fa28a4f249d71fa98

export async function getSitemapUrls(month: number, year: number, lang_code: string): Promise<SiteMapData[]> {

    const query = `
        SELECT
            EXTRACT(YEAR FROM f.published) as year,
            EXTRACT(MONTH FROM f.published) as month,
            f.published,
            r.news_json->>'link' AS link, 
            r.news_json->>'site_handle' AS site_handle,
            r.news_json->>'newsramp_curated' AS newsramp_curated,
            r.news_json->>'headline' AS headline, 
            r.id, 
            r.md5_permalink, 
            r.language
        FROM releases r
        JOIN feeditem f ON r.feed_item_id = f.id
        WHERE
            r.language = $1
            AND EXTRACT(MONTH FROM f.published) = $2
            AND EXTRACT(YEAR FROM f.published) = $3
            AND f.deleted_at IS NULL
            AND r.feed_item_id NOT IN (SELECT feed_item_id FROM moderated)
        ORDER BY year DESC, month DESC;
    `;

    let client;

    try {
        client = await getPool().connect();
        const { rows } = await client.query(query, [lang_code, month, year]);
        client.release();
        return rows.map((row: any) => ({
            site_handle: row.site_handle,
            link: row.link,
            headline: row.headline,
            language: row.language,
            newsramp_curated: row.newsramp_curated,
            md5_permalink: row.md5_permalink,
            published: row.published
        }));

    } catch (error) {
        console.error(error);
        if (client && typeof client.release === "function") {
            client.release();
        }
        return [];
    }
}