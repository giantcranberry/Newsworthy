import { getPosts, urlFor, getFeaturedPost, getBannerAdBySlug } from "@/sanity/sanity-utils";
import Link from "next/link";
import Image from "next/image";
import { formatDate } from "@/lib/utils";
import { PortableText } from "@portabletext/react";

export const revalidate = 300;

export default async function BlogIndex() {
    const [posts, featuredPost, bannerAd] = await Promise.all([
        getPosts(),
        getFeaturedPost(),
        getBannerAdBySlug("news-marketing-book"),
    ]);

    return (
        <div className="pb-16">
            {/* Banner Ad Hero */}
            {bannerAd && (
                <div
                    className="overflow-hidden text-white"
                    style={{
                        backgroundColor: bannerAd.backgroundColor ?? "#9D1D2B",
                        backgroundImage: bannerAd.useGradient && bannerAd.gradientFrom && bannerAd.gradientTo
                            ? `linear-gradient(${bannerAd.gradientDirection ?? "135deg"}, ${bannerAd.gradientFrom}, ${bannerAd.gradientVia ?? ""} ${bannerAd.gradientVia ? "," : ""} ${bannerAd.gradientTo})`
                            : undefined,
                    }}
                >
                    <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-8">
                        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 py-8 md:py-6">
                            {/* Book image — left */}
                            {bannerAd.bannerImage?.url && (
                                <div className="shrink-0 flex justify-center md:order-1">
                                    <Image
                                        src={bannerAd.bannerImage.url}
                                        alt={bannerAd.bannerImage.alt || bannerAd.headline || ""}
                                        width={bannerAd.bannerImage.width ?? 715}
                                        height={bannerAd.bannerImage.height ?? 565}
                                        className="h-40 md:h-48 w-auto drop-shadow-lg"
                                        priority
                                    />
                                </div>
                            )}
                            {/* Text + CTA — right */}
                            <div className="flex flex-col gap-3 text-center md:text-left md:order-2 min-w-0">
                                {bannerAd.logo?.url && (
                                    <Image
                                        src={bannerAd.logo.url}
                                        alt={bannerAd.logo.alt || ""}
                                        width={bannerAd.logo.width ?? 200}
                                        height={bannerAd.logo.height ?? 60}
                                        className="h-8 w-auto object-contain self-center md:self-start"
                                    />
                                )}
                                {bannerAd.headline && (
                                    <h2 className="font-serif font-semibold text-xl md:text-2xl lg:text-3xl text-balance leading-tight">
                                        {bannerAd.headline}
                                    </h2>
                                )}
                                {bannerAd.body && (
                                    <div className="text-sm md:text-base leading-relaxed opacity-90 text-balance">
                                        <PortableText value={bannerAd.body} />
                                    </div>
                                )}
                                {bannerAd.ctas?.length ? (
                                    <div className="flex flex-col sm:flex-row gap-3 mt-1 items-center md:items-start">
                                        {bannerAd.ctas.map((cta, i) => (
                                            <a
                                                key={i}
                                                href={cta.url}
                                                target={cta.openInNewTab ? "_blank" : undefined}
                                                rel={cta.sponsored ? "sponsored nofollow noopener noreferrer" : cta.url.startsWith("http") ? "noopener noreferrer" : undefined}
                                                className="inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-semibold transition-all hover:opacity-90 shadow-sm"
                                                style={{
                                                    backgroundColor: cta.bgColor || "#000000",
                                                    color: cta.textColor || "#ffffff",
                                                }}
                                            >
                                                {cta.label}
                                            </a>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="border-b border-gray-100 bg-gray-50/50">
                <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-8 py-8 lg:py-12">
                    <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
                        Newsworthy Blog
                    </h1>
                    <p className="mt-2 text-gray-500 text-base max-w-2xl">
                        Tips, insights, and strategies from the Newsworthy team to help you get the most out of your press releases.
                    </p>
                </div>
            </div>

            <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-8">
                {/* Featured post */}
                <Link
                    href={`/blog/${featuredPost.slug.current}`}
                    className="group flex flex-col md:flex-row gap-6 md:gap-10 mt-8 mb-14"
                >
                    <div className="md:w-3/5 overflow-hidden rounded-xl bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            className="w-full aspect-[16/10] object-cover transition duration-500 ease-in-out group-hover:scale-105"
                            src={featuredPost.coverImage && urlFor(featuredPost.coverImage.asset)}
                            alt={featuredPost.coverImage?.alt || featuredPost.headline || "Featured post"}
                        />
                    </div>
                    <div className="md:w-2/5 flex flex-col justify-center">
                        <span className="text-xs font-semibold uppercase tracking-widest text-cyan-700">Featured</span>
                        <h2 className="mt-2 text-2xl lg:text-3xl font-bold text-gray-900 group-hover:text-cyan-700 transition-colors leading-snug">
                            {featuredPost.headline}
                        </h2>
                        <p className="mt-3 text-gray-500 line-clamp-3 leading-relaxed">{featuredPost.excerpt}</p>
                        <div className="mt-6 flex items-center gap-3">
                            <Image
                                className="object-cover w-9 h-9 rounded-full"
                                src={urlFor(featuredPost.author.image)}
                                alt={`${featuredPost.author.name} avatar`}
                                width={36}
                                height={36}
                            />
                            <div>
                                <p className="text-sm font-medium text-gray-900">{featuredPost.author.name}</p>
                                {featuredPost.author.shortBio && (
                                    <p className="text-xs text-gray-400">{featuredPost.author.shortBio}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </Link>

                {/* Divider */}
                <div className="border-t border-gray-100 mb-10" />

                {/* Post grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {posts.map((post) =>
                        post._id != featuredPost._id ? (
                            <article key={post._id} className="group">
                                <Link href={`/blog/${post.slug.current}`} className="block">
                                    <div className="rounded-xl overflow-hidden bg-gray-100">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            className="w-full aspect-[16/10] object-cover transition duration-300 ease-in-out group-hover:scale-105"
                                            src={post.coverImage && urlFor(post.coverImage.asset)}
                                            alt={post.coverImage?.alt || post.headline || "Blog post"}
                                        />
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        <h3 className="font-serif text-lg font-semibold text-gray-900 leading-snug group-hover:text-cyan-700 transition-colors line-clamp-2">
                                            {post.headline}
                                        </h3>
                                        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                                            {post.excerpt}
                                        </p>
                                        <div className="flex items-center gap-2.5 pt-1">
                                            <Image
                                                className="object-cover w-7 h-7 rounded-full"
                                                src={urlFor(post.author.image)}
                                                alt={`${post.author.name} avatar`}
                                                width={28}
                                                height={28}
                                            />
                                            <p className="text-xs font-medium text-gray-500">{post.author.name}</p>
                                        </div>
                                    </div>
                                </Link>
                            </article>
                        ) : null
                    )}
                </div>
            </div>
        </div>
    );
}
