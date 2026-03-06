import { getCategoryBySlug, urlFor } from "@/sanity/sanity-utils";
import Image from "next/image";
import Link from "next/link";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export default async function Category({ params }: Props) {
    const { slug } = await params;
    const { categoryName, description, coverImage, posts } = await getCategoryBySlug(slug);

    return (
        <>
            <div>
                <div className="mx-auto flex flex-col max-w-3xl gap-10 md:gap-20 lg:mt-5 px-5 py-5 md:py-10">
                    {coverImage && (
                        <div className="flex justify-center">
                            <Image
                                className="h-48 w-48 rounded-full"
                                src={coverImage && urlFor(coverImage.asset)}
                                alt={`${categoryName} Category Image`}
                                width={200}
                                height={1}
                            />
                        </div>
                    )}
                    <div className="flex flex-col">
                        <h2 className="pb-2 font-serif text-stone-900 text-3xl lg:text-4xl">{categoryName}</h2>
                        <p>{description}</p>
                    </div>
                </div>
                <div className="mx-auto flex max-w-3xl flex-col px-5">
                    <h2 className="my-5 font-sans font-bold text-cyan-900">Read more the category {categoryName}</h2>
                    {posts.map((post) => {
                        return (
                            <div key={post._id} className="mb-5">
                                <Link
                                    href={`/blog/${post.slug}`}
                                    key={post._id}
                                    className="group grid grid-cols-1 md:grid-cols-3 gap-y-4 md:gap-4 rounded-lg bg-white p-5 transition duration-500 hover:drop-shadow-lg"
                                >
                                    <Link href={`/blog/${post.slug}`} className="overflow-hidden rounded w-full">
                                        <Image
                                            className="hover:translate-12 h-full w-full object-cover transition duration-500 ease-in-out group-hover:scale-105"
                                            src={post.coverImage && urlFor(post.coverImage)}
                                            alt="category image"
                                            width={780}
                                            height={390}
                                            loading="lazy"
                                        />
                                    </Link>
                                    <div className="col-span-2">
                                        <h3 className="m-0 mb-3 font-serif text-xl group-hover:text-cyan-900">
                                            <Link href={`/blog/${post.slug}`}>{post.headline}</Link>
                                        </h3>
                                        <p className="mb-3 line-clamp-3 text-sm leading-5">{post.excerpt}</p>
                                    </div>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
