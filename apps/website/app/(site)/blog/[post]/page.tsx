import { getPostBySlug, urlFor } from "@/sanity/sanity-utils";
import Image from "next/image";
import { PortableText } from "@portabletext/react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { PortableTextImageComponent } from "@/components/portable_text_component";
import { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import GetTheBook from "@/components/get-the-book";

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
    const post = await getPostBySlug(slug);
    // https://www.npmjs.com/package/@sanity/image-url
    return (
        <>
            <div className="pt-5">
                <div className="flex flex-col-reverse lg:flex-row bg-white">
                    <div className="flex flex-col justify-center gap-5 lg:gap-7 bg-yellow-800/5 text-center py-10 lg:px-20 lg:w-1/2 lg:">
                        <div className="flex items-center justify-center gap-3 lg:gap-5">
                            <Link
                                href={`/blog/category/${post.category.slug.current}`}
                                className="font-bold text-lg lg:text-base text-cyan-700 hover:underline"
                            >
                                {post.category.categoryName}
                            </Link>
                        </div>
                        <h1 className="font-serif text-3xl lg:text-4xl font-semibold">{post.headline}</h1>
                        <div className="flex items-center justify-center gap-3">
                            <Image
                                className="w-11 h-11 object-cover object-right rounded-full"
                                src={urlFor(post.author.image)}
                                alt={`${post.author.name} avatar`}
                                width={50}
                                height={1}
                            />
                            <div className="text-left">
                                <p className="text-lg lg:text-base font-semibold text-sky-950">
                                    <Link
                                        href={`/blog/contributor/${post.author.slug.current}`}
                                        className="hover:underline"
                                    >
                                        {post.author.name}
                                    </Link >
                                    
                                </p>
                                {post.author.shortBio && <p className="text-sm">{post.author.shortBio}</p>}
                            </div>
                        </div>
                    </div>
                    <div className="lg:w-1/2">
                        <Image
                            className="block max-h-full md:h-96 lg:min-h-[449px] w-full object-cover"
                            src={post.coverImage && urlFor(post.coverImage.asset)}
                            alt={`${post.coverImage.alt}`}
                            width={1200}
                            height={464}
                        />
                    </div>
                </div>

                <div className="relative grid lg:grid-cols-12 gap-10 prose mx-auto my-5 md:max-w-5xl lg:max-w-7xl px-7 lg:px-20 text-gray-700 prose-headings:font-serif prose-headings:text-3xl prose-headings:font-normal prose-p:text-lg">
                    <div className="col-span-9">
                        {post.excerpt && <p className="text-xl text-slate-600 pb-5">{post.excerpt}</p>}
                        <div className="first-letter:float-left first-letter:mb-0 first-letter:pr-4 first-letter:font-serif first-letter:text-7xl first-letter:text-cyan-900 text-lg lg:text-base prose-img:aspect-16/9 prose-li:text-lg prose-blockquote:text-lg">
                            <PortableText
                                value={post.content}
                                components={{
                                    // ...
                                    types: {
                                        image: PortableTextImageComponent,
                                    },
                                }}
                            />
                        </div>
                    </div>
                    <div className="col-span-3">
                        <GetTheBook />
                    </div>
                </div>
            </div>
        </>
    );
}
