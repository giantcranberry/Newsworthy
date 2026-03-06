import { getPosts, urlFor, getFeaturedPost } from "@/sanity/sanity-utils";
import Link from "next/link";
import Image from "next/image";
import { formatDate } from "@/lib/utils";

export const revalidate = 300;

export default async function BlogIndex() {
    const posts = await getPosts();
    const featuredPost = await getFeaturedPost();

    return (
        <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 py-10 lg:py-16">
            {/* Header */}
            <div className="max-w-2xl mb-12">
                <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">Newsworthy Blog</h1>
                <p className="mt-3 text-lg text-gray-600">
                    Tips, insights, and strategies from the Newsworthy team to help you get the most out of your press releases.
                </p>
            </div>

            {/* Featured post */}
            <Link
                href={`/blog/${featuredPost.slug.current}`}
                className="group flex flex-col md:flex-row gap-6 md:gap-8 mb-16"
            >
                <div className="md:w-3/5 overflow-hidden rounded-xl border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        className="w-full aspect-[16/10] object-cover transition duration-500 ease-in-out group-hover:scale-105"
                        src={featuredPost.coverImage && urlFor(featuredPost.coverImage.asset)}
                        alt={featuredPost.coverImage?.alt || featuredPost.headline || "Featured post"}
                    />
                </div>
                <div className="md:w-2/5 flex flex-col justify-center">
                    <span className="text-sm font-medium text-cyan-700 mb-2">Featured</span>
                    <h2 className="text-2xl lg:text-3xl font-bold group-hover:text-cyan-700 transition-colors">
                        {featuredPost.headline}
                    </h2>
                    <p className="mt-3 text-gray-600 line-clamp-3">{featuredPost.excerpt}</p>
                    <div className="mt-6 flex items-center gap-3">
                        <Image
                            className="object-cover w-10 h-10 rounded-full"
                            src={urlFor(featuredPost.author.image)}
                            alt={`${featuredPost.author.name} avatar`}
                            width={40}
                            height={40}
                        />
                        <div>
                            <p className="text-sm font-semibold">{featuredPost.author.name}</p>
                            {featuredPost.author.shortBio && (
                                <p className="text-xs text-gray-500">{featuredPost.author.shortBio}</p>
                            )}
                        </div>
                    </div>
                </div>
            </Link>

            {/* Post grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.map((post) =>
                    post._id != featuredPost._id ? (
                        <Link
                            href={`/blog/${post.slug.current}`}
                            key={post._id}
                            className="group flex flex-col h-full"
                        >
                            <div className="overflow-hidden rounded-xl border border-gray-200 aspect-[16/10]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    className="w-full h-full object-cover transition duration-300 ease-in-out group-hover:scale-105"
                                    src={post.coverImage && urlFor(post.coverImage.asset)}
                                    alt={post.coverImage?.alt || post.headline || "Blog post"}
                                />
                            </div>
                            <div className="mt-4 flex flex-col flex-1">
                                <h3 className="text-lg font-semibold group-hover:text-cyan-700 transition-colors line-clamp-2">
                                    {post.headline}
                                </h3>
                                <p className="mt-2 text-sm text-gray-600 line-clamp-2">{post.excerpt}</p>
                                <div className="mt-auto pt-4 flex items-center gap-3">
                                    <Image
                                        className="object-cover w-8 h-8 rounded-full"
                                        src={urlFor(post.author.image)}
                                        alt={`${post.author.name} avatar`}
                                        width={32}
                                        height={32}
                                    />
                                    <p className="text-sm font-medium text-gray-700">{post.author.name}</p>
                                </div>
                            </div>
                        </Link>
                    ) : null
                )}
            </div>
        </div>
    );
}
