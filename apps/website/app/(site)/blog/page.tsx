import { getPosts, urlFor, getFeaturedPost } from "@/sanity/sanity-utils";
import Link from "next/link";
import Image from "next/image";
import { formatDate } from "@/lib/utils";

export const revalidate = 300;

export default async function BlogIndex() {
    const posts = await getPosts();
    const featuredPost = await getFeaturedPost();

    return (
        <div className="mx-auto w-full  md:max-w-5xl lg:max-w-7xl 2xl:max-w-screen-2xl mt-5 px-5 py-10 lg:px-20 xl:px-20">
            <div className="text-center prose prose-p:text-lg prose-h1:mb-0 max-w-none">
                <h1 className="font-serif text-4xl lg:text-4xl font-semibold">The News Marketing Blog</h1>
                <p>
                    Blog posts and useful information from the Newsworthy team and our contributors to help you on your
                    journey to becoming a better News Marketer.
                </p>
            </div>

            <Link
                href={`/blog/${featuredPost.slug.current}`}
                className="group my-10 w-full flex flex-col lg:grid grid-cols-1 rounded bg-white transition duration-500 hover:drop-shadow-lg md:grid-cols-2"
            >
                <div className="overflow-hidden rounded-bl rounded-tl">
                    <Image
                        className="hover:translate-12 w-full object-cover transition duration-500 ease-in-out group-hover:scale-105 h-full md:h-96 lg:h-full"
                        src={featuredPost.coverImage && urlFor(featuredPost.coverImage.asset)}
                        alt={featuredPost.coverImage && featuredPost.coverImage.alt}
                        width={460}
                        height={1}
                    />
                </div>
                <div className="flex flex-col justify-between p-5 md:p-10">
                    <div className="grid gap-4">
                        <h2 className="font-serif text-3xl group-hover:text-cyan-900 font-semibold">
                            {featuredPost.headline}
                        </h2>
                        <p className="line-clamp-3 text-lg lg:text-base">{featuredPost.excerpt}</p>
                        <p className="underline underline-offset-4 group-hover:text-cyan-900">Read the blog post</p>
                    </div>
                    <div className="mt-10 flex justify-between">
                        <div className="flex items-center gap-3">
                            <Image
                                className="object-cover object-right w-11 h-11 rounded-full"
                                src={urlFor(featuredPost.author.image)}
                                alt={`${featuredPost.author.name} avatar`}
                                width={100}
                                height={1}
                            />
                            <div>
                                <p className="text-sm font-bold">{featuredPost.author.name}</p>
                                {featuredPost.author.shortBio && (
                                    <p className="text-sm">{featuredPost.author.shortBio}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Link>

            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) =>
                    post._id != featuredPost._id ? (
                        <Link
                            href={`/blog/${post.slug.current}`}
                            key={post._id}
                            className="group mb-0 w-full rounded bg-white transition duration-300 hover:drop-shadow-lg"
                        >
                            <div className="overflow-hidden rounded-tl rounded-tr">
                                <Image
                                    className="hover:translate-12 h-[230px] 2xl:h-[275px] w-full object-cover transition duration-300 ease-in-out group-hover:scale-105"
                                    src={post.coverImage && urlFor(post.coverImage.asset)}
                                    alt={post.coverImage && post.coverImage.alt}
                                    width={460}
                                    height={1}
                                />
                            </div>

                            <div className="flex flex-col justify-between gap-10 p-5">
                                <div>
                                    <h3 className="pb-3 font-serif text-xl group-hover:text-cyan-900 font-semibold">
                                        {post.headline}
                                    </h3>
                                    <p className="font-sans text-lg lg:text-base mb-3 line-clamp-3">{post.excerpt}</p>
                                    <p className="underline text-lg lg:text-base underline-offset-4 group-hover:text-cyan-900">
                                        Read the blog post
                                    </p>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Image
                                            className="object-cover object-right w-11 h-11 rounded-full"
                                            src={urlFor(post.author.image)}
                                            alt={`${post.author.name} avatar`}
                                            width={100}
                                            height={1}
                                        />
                                        <div>
                                            <p className="text-sm font-bold">{post.author.name}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ) : null
                )}
            </div>
        </div>
    );
}
