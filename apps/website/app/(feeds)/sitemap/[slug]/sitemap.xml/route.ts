getSitemapSanityUrls

import { baseUrl, computeLastMod, formatDateForSitemap } from '@/lib/utils';
import { getSitemapSanityUrls } from '@/sanity/sanity-utils';
import { SitemapUrlSanity } from '@/types/Post';
import { getServerSideSitemap } from 'next-sitemap';
import { notFound } from 'next/navigation';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, { params }: Props) {

  let {slug} = await params;

  if (slug !== 'site-pages' && slug !== 'blog-posts') {
    return notFound();
  }

  let collection: string = "page"

  if (slug === 'blog-posts') {
    collection = "post"
  }

  const url_data = await getSitemapSanityUrls(collection) as SitemapUrlSanity[];

  const sitemap = [
    ...url_data.map((url) => ({
      loc: `${baseUrl}/${collection=='post'?'blog/':''}${url.slug.current}`,
      lastmod: url._updatedAt,
    })),

  ];

  return getServerSideSitemap(sitemap);
}
