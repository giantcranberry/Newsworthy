import { getAuthorBySlug, urlFor } from "@/sanity/sanity-utils";
import Image from "next/image";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

type Props = {
	params: Promise<{ author: string }>;
};

export default async function Author({ params }: Props) {
	const { author: slug } = await params;
	const author = await getAuthorBySlug(slug);
	// https://www.npmjs.com/package/@sanity/image-url

	return (
		<>
			<div>
				<div className="mx-auto flex flex-col lg:flex-row w-full lg:max-w-3xl lg:gap-20 lg:mt-5 px-5 py-5 md:py-10 lg:px-0">
					{author.image && (
						<div className="flex justify-center">
							<Image
								className="h-48 w-48 rounded-full"
								src={author.image && urlFor(author.image.asset)}
								alt={`${author.name} photo or avatar`}
								width={200}
								height={1}
							/>
						</div>
					)}
					<div className="flex flex-col pt-5 lg:pt-0 text-center md:text-left">
						<p className="font-sans text-lg font-bold text-stone-500">
							Contributing author
						</p>
						<h2 className="font-serif text-stone-900 text-2xl lg:text-4xl">
							{author.name}
						</h2>
						<p>{author.shortBio}</p>
					</div>
				</div>
				<div className="lg:mx-auto flex w-full lg:max-w-3xl flex-col px-5 lg:px-0 mb-5">
					<h2 className="mb-5 font-sans font-bold text-cyan-900">
						Read more from {author.name}
					</h2>
					{author.posts.map((post) => {
						return (
							<div key={post._id} className="mb-5">
								<Link
									href={`/blog/${post.slug}`}
									key={post._id}
									className="group grid grid-cols-1 lg:grid-cols-3 gap-y-4 md:gap-4 rounded-lg bg-white p-5 transition duration-500 hover:drop-shadow-lg ">
									<Link
										href={`/blog/${post.slug}`}
										className="overflow-hidden rounded col-span-1">
										<Image
											className="hover:translate-12 lg:h-full lg:w-full object-cover transition duration-500 ease-in-out group-hover:scale-105"
											src={post.coverImage && urlFor(post.coverImage)}
											alt={`${author.name} photo or avatar`}
											width={780}
											height={390}
											loading="lazy"
										/>
									</Link>
									<div className="col-span-2">
										<h3 className="m-0 mb-3 font-serif text-xl group-hover:text-cyan-900">
											<Link href={`/blog/${post.slug}`}>{post.headline}</Link>
										</h3>
										<p className="mb-3 line-clamp-3 text-sm leading-5">
											{post.excerpt}
										</p>
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
