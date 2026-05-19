import { getPostBySlug, getBannerAdBySlug, urlFor } from "@/sanity/sanity-utils";
import Image from "next/image";
import { PortableText } from "@portabletext/react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { PortableTextImageComponent, BannerAdEmbedComponent } from "@/components/portable_text_component";
import { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import BannerAdBlock from "@/components/banner-ad/banner-ad-block";

export const revalidate = 300;

type CustomMetadata = Metadata & {
    revalidate?: number;
};

type Props = {
    params: Promise<{ post: string }>;
};

export async function generateMetadata({ params }: Props): Promise<CustomMetadata> {
    const { post } = await params;
    // fetch data
    const postData = await getPostBySlug(post);
    if (!postData) {
        return notFound();
    }

    return {
        title: postData.headline,
        description: postData.excerpt,
        openGraph: {
            title: postData.headline!,
            description: postData.excerpt!,
            images: [
                {
                    url: postData.coverImage && urlFor(postData.coverImage.asset),
                    width: 1200,
                    height: 630,
                },
                {
                    url: postData.coverImage && urlFor(postData.coverImage.asset),
                    width: 1200,
                    height: 675,
                },
                {
                    url: postData.coverImage && urlFor(postData.coverImage.asset),
                    width: 800,
                    height: 418,
                },
                {
                    url: postData.coverImage && urlFor(postData.coverImage.asset),
                    width: 300,
                    height: 157,
                },
            ],
        },
        revalidate: 60 * 60 * 24,
    };
}

export default async function Post({ params }: Props) {
    const { post: slug } = await params;
    const [post, sidebarAd] = await Promise.all([
        getPostBySlug(slug),
        getBannerAdBySlug("news-marketing-book"),
    ]);
    return (
        <article className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 py-5">
            {/* Hero */}
            <div className="flex flex-col lg:flex-row items-center gap-10 py-16 lg:py-24">
                <div className="flex-1 text-center lg:text-left">
                    <Link
                        href={`/blog/category/${post.category.slug.current}`}
                        className="inline-block text-sm font-medium uppercase tracking-wider text-cyan-700 hover:text-cyan-800 mb-4"
                    >
                        {post.category.categoryName}
                    </Link>
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">{post.headline}</h1>
                    {post.excerpt && (
                        <p className="mt-4 text-lg text-gray-600 max-w-lg mx-auto lg:mx-0">{post.excerpt}</p>
                    )}
                    <div className="flex items-center gap-3 mt-6 justify-center lg:justify-start">
                        <Image
                            className="w-10 h-10 object-cover rounded-full"
                            src={urlFor(post.author.image)}
                            alt={`${post.author.name} avatar`}
                            width={40}
                            height={40}
                        />
                        <div className="text-left">
                            <Link
                                href={`/blog/contributor/${post.author.slug.current}`}
                                className="text-sm font-semibold hover:underline"
                            >
                                {post.author.name}
                            </Link>
                            {post.author.shortBio && <p className="text-xs text-gray-500">{post.author.shortBio}</p>}
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden rounded-xl border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        className="w-full aspect-[16/10] object-cover"
                        src={post.coverImage && urlFor(post.coverImage.asset)}
                        alt={post.coverImage?.alt || post.headline || "Blog post"}
                    />
                </div>
            </div>

            <hr className="border-gray-200 mb-10" />

            {/* Content */}
            <div className="grid lg:grid-cols-12 gap-10">
                <div className="lg:col-span-9 prose prose-gray max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:text-base prose-li:text-base prose-blockquote:text-base prose-img:rounded-xl prose-a:text-cyan-700 hover:prose-a:text-cyan-600">
                    <div className="first-letter:float-left first-letter:mb-0 first-letter:pr-4 first-letter:font-serif first-letter:text-7xl first-letter:text-cyan-900">
                        <PortableText
                            value={post.content}
                            components={{
                                types: {
                                    image: PortableTextImageComponent,
                                    bannerAdEmbed: BannerAdEmbedComponent,
                                },
                            }}
                        />
                    </div>
                </div>
                <aside className="lg:col-span-3">
                    <div className="sticky top-10">
                        {sidebarAd ? (
                            <BannerAdBlock ad={sidebarAd} stacked />
                        ) : null}
                    </div>
                </aside>
            </div>
        </article>
    );
}
