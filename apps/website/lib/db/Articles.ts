import { runQuery, runSingleRowQuery } from "@/lib/neon";
import { Article, ArticleSingle } from "@/types/Articles";
import { PressRelease, ReleaseMonths } from "@/types/Release";

export async function getArticleMonths(): Promise<ReleaseMonths[]> {
  const query = `
      SELECT
      EXTRACT(YEAR FROM f.published) as year,
      EXTRACT(MONTH FROM f.published) as month,
      'en' as language_code
      FROM articles a
      INNER JOIN feeditem f ON f.id = a.feed_item_id
      INNER JOIN tldr t ON t.feed_item_id = a.feed_item_id
      WHERE f.deleted_at IS NULL
      AND a.target = 'newsworthy.ai'
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `;

  const result = await runQuery<{
    year: number;
    month: number;
    language_code: string;
  }>(query);
  return result.map(({ year, month, language_code }) => ({
    year,
    month,
    language_code,
  }));
}

export async function getSitemapArticleUrls(year: number, month: number) {
  const query = `
    SELECT
    a.article_json->>'headline' AS title,
    f.id as id,
    f.published as released_at
    FROM articles a
    INNER JOIN feeditem f ON f.id = a.feed_item_id
    INNER JOIN tldr t ON t.feed_item_id = a.feed_item_id
    WHERE f.deleted_at IS NULL
    AND EXTRACT(YEAR FROM f.published) = $1
    AND EXTRACT(MONTH FROM f.published) = $2
    AND a.target = 'newsworthy.ai'
    ORDER BY released_at DESC
    `;
  const result = await runQuery<{
    id: number;
    released_at: Date;
    title: string;
  }>(query, [year, month]);
  return result.map(({ title, id, released_at }) => ({
    title,
    id,
    released_at,
  }));
}

/** md5_permalink values for curated articles that match the given PR hashes */
export async function getCuratedPermalinkSet(
  prHashes: string[],
): Promise<Set<string>> {
  if (prHashes.length === 0) {
    return new Set();
  }

  const query = `
    SELECT DISTINCT a.md5_permalink
    FROM articles a
    INNER JOIN feeditem f ON f.id = a.feed_item_id
    WHERE f.deleted_at IS NULL
      AND a.target = 'newsworthy.ai'
      AND a.md5_permalink = ANY($1)
  `;
  const result = await runQuery<{ md5_permalink: string }>(query, [prHashes]);
  return new Set(result.map((r) => r.md5_permalink));
}

export async function getRecentArticles(hoursAgo: number = 48) {
  const query = `
    SELECT
      a.article_json->>'headline' AS title,
      f.id as id,
      f.published as released_at
    FROM articles a
    INNER JOIN feeditem f ON f.id = a.feed_item_id
    INNER JOIN tldr t ON t.feed_item_id = a.feed_item_id
    WHERE f.deleted_at IS NULL
      AND a.target = 'newsworthy.ai'
      AND f.published >= NOW() - make_interval(hours => $1)
      AND f.published <= NOW()
    ORDER BY f.published DESC
  `;
  const result = await runQuery<{
    id: number;
    released_at: Date;
    title: string;
  }>(query, [hoursAgo]);
  return result.map(({ title, id, released_at }) => ({
    title,
    id,
    released_at,
  }));
}

// Function to get total count of articles
export async function getArticlesCount(): Promise<number> {
  const query = `
    SELECT COUNT(*) as count
    FROM articles a
    INNER JOIN feeditem f ON f.id = a.feed_item_id
    INNER JOIN tldr t ON t.feed_item_id = a.feed_item_id
    WHERE f.deleted_at IS NULL
      AND a.target = 'newsworthy.ai'
  `;

  const result = await runSingleRowQuery<{ count: string }>(query, []);
  return result ? parseInt(result.count, 10) : 0;
}

// Function to query the database with pagination
export async function getArticles(page: number = 1, limit: number = 30): Promise<Article[]> {
  const offset = (page - 1) * limit;
  const query = `
      SELECT
      a.feed_item_id,
      a.md5_permalink,
      t.site_handle,
      a.article_json->>'headline' AS headline,
      a.article_json->>'content' AS content,
      f.enclosure,
      a.article_json->>'summary' AS summary,
      t.tldr_json->>'published' AS published,
      t.tldr_json->>'link' AS link,
      t.tldr_json->>'seo_description' AS seo_description,
      t.tldr_json->>'newsramp_url' AS newsramp_url,
      t.tldr_json->>'site_name' AS site_name,
      t.tldr_json->>'site_url' AS site_url
    FROM articles a
    INNER JOIN feeditem f ON f.id = a.feed_item_id
    INNER JOIN tldr t ON t.feed_item_id = a.feed_item_id
    WHERE f.deleted_at IS NULL
      AND a.target = 'newsworthy.ai'
    ORDER BY a.created_at DESC
    LIMIT $1
    OFFSET $2
    `;

  return await runQuery<Article>(query, [limit, offset]);
}

export async function getArticleById(
  feed_item_id: number,
): Promise<ArticleSingle | null> {
  const query = `
      SELECT
      a.feed_item_id,
      a.md5_permalink,
      t.site_handle,
      a.article_json->>'headline' AS headline,
      a.article_json->>'content' AS content,
      f.enclosure,
      a.article_json->>'summary' AS summary,
      t.tldr_json->>'published' AS published,
      t.tldr_json->>'link' AS link,
      t.tldr_json->>'seo_description' AS seo_description,
      t.tldr_json->>'site_name' AS site_name,
      t.tldr_json->>'site_url' AS site_url
    FROM articles a
    INNER JOIN feeditem f ON f.id = a.feed_item_id
    INNER JOIN tldr t ON t.feed_item_id = a.feed_item_id
    WHERE a.feed_item_id = $1
      AND f.deleted_at IS NULL
      AND a.target = 'newsworthy.ai'
    ORDER BY f.published DESC
    LIMIT 1;
    `;

  return await runSingleRowQuery<ArticleSingle>(query, [feed_item_id]);
}

export async function getArticleByPRHashId(
  PRHashId: string,
): Promise<ArticleSingle | null> {
  const query = `
      SELECT
      a.feed_item_id,
      a.md5_permalink,
      t.site_handle,
      a.article_json->>'headline' AS headline,
      a.article_json->>'content' AS content,
      f.enclosure,
      a.article_json->>'summary' AS summary,
      t.tldr_json->>'published' AS published,
      t.tldr_json->>'seo_description' AS seo_description
    FROM articles a
    INNER JOIN feeditem f ON f.id = a.feed_item_id
    INNER JOIN tldr t ON t.feed_item_id = a.feed_item_id
    WHERE a.md5_permalink = $1
      AND f.deleted_at IS NULL
      AND a.target = 'hrmarketer.com'
    ORDER BY f.published DESC
    LIMIT 1;
    `;

  return await runSingleRowQuery<ArticleSingle>(query, [PRHashId]);
}
