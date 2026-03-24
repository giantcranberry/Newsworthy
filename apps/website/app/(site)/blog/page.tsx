import { getPosts, urlFor, getFeaturedPost } from "@/sanity/sanity-utils";
import Link from "next/link";
import Image from "next/image";
import { formatDate } from "@/lib/utils";

export const revalidate = 300;

export default async function BlogIndex() {
    const posts = await getPosts();
    const featuredPost = await getFeaturedPost();

    return (
        <div className="pb-16">
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
