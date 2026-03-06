"use server"

import { db, sql } from '@/lib/db';
import { ReleaseMonths } from '@/types/Release';

export async function getReleaseMonths(): Promise<ReleaseMonths[]> {
    const releaseMonths = await db.execute<ReleaseMonths>(sql`
      SELECT
        EXTRACT(YEAR FROM release_at) as year,
        EXTRACT(MONTH FROM release_at) as month
      FROM releases
      WHERE
        release_at <= NOW()
        AND approved_at IS NOT NULL
        AND is_deleted IS NOT TRUE
        AND status = 'sent'
      GROUP BY year, month
      ORDER BY year DESC, month DESC;
    `);

    return releaseMonths as unknown as ReleaseMonths[];
  }

export async function getTranslatedReleaseMonths(): Promise<ReleaseMonths[]> {
    const releaseMonths = await db.execute<ReleaseMonths>(sql`
      SELECT
        language_code,
        EXTRACT(YEAR FROM release_at) as year,
        EXTRACT(MONTH FROM release_at) as month
      FROM translations
      WHERE
        release_at <= NOW()
      GROUP BY language_code, year, month
      ORDER BY language_code ASC, year DESC, month DESC;
    `);

    return releaseMonths as unknown as ReleaseMonths[];
  }

export async function getSitemapUrls(year: number, month: number) {
    const currentDatetime = new Date().toISOString();

    const urls = await db.execute(
      sql`SELECT slug, id, released_at as release_datetime, timezone, title
        FROM releases
        WHERE EXTRACT(YEAR FROM released_at) = ${year}
          AND EXTRACT(MONTH FROM released_at) = ${month}
          AND release_at <= ${currentDatetime}
          AND approved_at IS NOT NULL
          AND is_deleted IS NOT TRUE
        ORDER BY release_at DESC`
    );

    return urls;
  }

export async function getSitemapLanguageUrls(year: number, month: number, lang_code: string) {
    const currentDatetime = new Date().toISOString();

    return await db.execute(
      sql`SELECT slug, pr_id as id, release_at as release_datetime, title
        FROM translations
        WHERE EXTRACT(YEAR FROM release_at) = ${year}
          AND EXTRACT(MONTH FROM release_at) = ${month}
          AND language_code = ${lang_code}
          AND release_at <= ${currentDatetime}
        ORDER BY release_at DESC`
    );
  }
