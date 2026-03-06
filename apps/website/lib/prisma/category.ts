"use server"

import { db, sql } from '@/lib/db';

export default async function TopCategoriesWithNews() {
  const currentDatetime = new Date().toISOString()

  // This query is complex with nested relations through release_categories.
  // Using raw SQL is cleaner than trying to replicate Prisma's nested `some` filter.
  const categories = await db.execute(sql`
    SELECT DISTINCT c.slug, c.name, c.description
    FROM category c
    WHERE (
      c.parent_slug = 'top'
      AND EXISTS (
        SELECT 1 FROM release_categories rc
        JOIN releases r ON r.id = rc.release_id
        WHERE rc.category_id = c.id
          AND r.release_at <= ${currentDatetime}
          AND r.approved_at <= ${currentDatetime}
      )
    )
    OR c.slug = 'business-cryptocurrency-news'
    OR c.slug = 'industry-cannabis-news'
    ORDER BY c.name ASC
  `);

  return categories || [];
}
