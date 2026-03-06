import PageBreadcrumb from "@/components/page-breadcrumb";
import { getArticleById, getArticleByPRHashId } from "@/lib/db/Articles";
import {
  formatDateString,
  getFeedItemIdFromUrl,
  slugify,
} from "@/lib/article_utils";
import { Article, ArticleSingle } from "@/types/Articles";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 0;

type Props = {
  params: Promise<{ slug: string; story_id: string }>;
};

export const generateMetadata = async (props: Props): Promise<Metadata> => {
  const metadataBase = new URL("https://www.newsworthy.ai/");
  const resolvedParams = await props.params;

  let article: ArticleSingle | null = null;

  if (resolvedParams.story_id.length < 30) {
    const feedItemId = getFeedItemIdFromUrl(resolvedParams.story_id);
    article = await getArticleById(feedItemId);
  } else {
    article = await getArticleByPRHashId(resolvedParams.story_id);
  }

  if (!article) {
    return notFound();
  }

  return {
    title: article.headline,
    description: article.summary,
    alternates: {
      canonical: `${metadataBase}curated/${resolvedParams.slug}/${resolvedParams.story_id}`,
    },
    openGraph: {
      title: `${article.headline ?? ""}`,
      description: `${article.summary ?? ""}`,
      images: [
        {
          url: article.enclosure,
        },
      ],
    },
  };
};

export default async function NewsPage(props: Props) {
  const resolvedParams = await props.params;
  const { story_id } = resolvedParams;

  let article: ArticleSingle | null = null;

  if (story_id.length < 30) {
    const feedItemId = getFeedItemIdFromUrl(story_id);
    article = await getArticleById(feedItemId);
  } else {
    article = await getArticleByPRHashId(story_id);
  }

  // Check if the article was found
  if (!article || !article.feed_item_id) {
    return notFound();
  }

  return (
    <section className="mx-auto w-full xl:max-w-screen-xl my-10 px-5 lg:px-10">
      {article && (
        <>
          <PageBreadcrumb currentPage={article.headline} />
          <article
            key={article.feed_item_id}
            className="max-w-none prose prose-h1:font-serif prose-h1:font-semibold prose-h1:text-black prose-h1:text-3xl lg:prose-h1:text-4xl prose-p:text-black prose-p:text-lg prose-p:font-normal prose-lead:text-xl lg:prose-lead:text-2xl prose-lead:font-thin prose-img:my-0 prose-a:text-sstone-900 hover:prose-a:text-sky-700 prose-strong:text-black prose-li:text-black prose-li:text-lg prose-li:marker:text-sky-700 prose-img:rounded-lg prose-img:w-[600px] prose-img:mx-auto"
          >
            <h1>{article.headline}</h1>
            <p>
              {formatDateString(article.published)}
              <br />
              By: <a href="https://newsworthy.ai">Newsworthy Staff</a>
            </p>

            <p className="lead">{article.summary}</p>

            <Image
              width={600}
              height={400}
              src={article.enclosure}
              alt={article.headline}
              className="rounded-lg w-1/2"
              sizes="50vw"
            />

            <div
              className="!text-slate-200 mt-10"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            <div>
              <h3>Source Statement</h3>
              <p>
                This news article relied primarily on a press release disributed
                by <Link href={article.site_url}>{article.site_name}</Link>.
                <Link href={article.link}>
                  {" You can read the source press release here, "}
                </Link>
              </p>

              <Link
                href={`https://newsramp.com/blockchain/txn_detail/${article.md5_permalink}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://cdn.newsramp.net/qrcode/${article.md5_permalink}.webp`}
                  alt="blockchain registration record for the source press release."
                  width={200}
                  height={200}
                  className="!w-[300px] !rounded !mb-10 !mx-0"
                />
              </Link>
            </div>
          </article>
        </>
      )}
      ;
    </section>
  );
}
