import Features from "@/components/features";
import { getFeatures, getPage, urlFor } from "@/sanity/sanity-utils";
import page from "@/sanity/schemas/page";
import { PortableText } from "@portabletext/react";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
	// fetch data
	const page = await getPage("pricing");
	if (!page) {
		return notFound();
	}

	return {
		title: "Pricing",
		description: page.seo_description,
		openGraph: {
			title: "Pricing"!,
			description: page.seo_description!,
			images: [
				{
					url: page.hero_image && urlFor(page.hero_image.asset),
					width: 1200,
					height: 630,
				},
				{
					url: page.hero_image && urlFor(page.hero_image.asset),
					width: 1200,
					height: 675,
				},
				{
					url: page.hero_image && urlFor(page.hero_image.asset),
					width: 800,
					height: 418,
				},
			],
		},
	};
}

export default async function ContactPage() {
	const page = await getPage("pricing");
	const base_features = await getFeatures("base");
	const agency_features = await getFeatures("agency");

	return (
		<div className="pt-5">
			<div className="flex flex-col-reverse lg:grid lg:grid-cols-12 w-full h-full">
				<div className="bg-stone-200 max-h-fit md:col-span-5 flex flex-col items-start p-10 lg:px-20 lg:py-10">
					{page.hero_headline && (
						<h1 className="font-serif text-3xl md:text-4xl xl:text-5xl text-inherit font-semibold mb-3">
							{page.hero_headline}
						</h1>
					)}
					{page.hero_text && (
						<div className="mt-2 font-sans prose-md md:prose-lg xl:prose-2xl prose prose-h3:text-2xl md:prose-h3:text-3xl prose-p:text-xl lg:prose-p:text-base">
							<PortableText value={page.hero_text} />
						</div>
					)}
					{page.hero_cta.cta_link && (
						<Link
							href={page.hero_cta.cta_link}
							className="rounded bg-cyan-900 hover:bg-cyan-800 text-white font-bold mt-5 md:mt-10 px-5 py-3">
							{page.hero_cta.cta_text}
						</Link>
					)}
				</div>
				{page.hero_image && (
					<div className="lg:col-span-7 relative text-center">
						<h2 className="absolute inset-x-0 top-0 text-white text-7xl md:text-8xl xl:text-9xl pt-10 font-bold">
							<span className="text-4xl">Just</span> $129
						</h2>

						<Image
							className="w-full md:h-96 lg:h-full object-cover"
							src={page.hero_image && urlFor(page.hero_image.asset)}
							alt={page.hero_image && page.hero_image.alt}
							width={1200}
							height={464}
						/>
						<p className="absolute inset-x-0 bottom-0 text-white text-2xl md:text-3xl pb-5 xl:pb-10 font-bold">
							&quot;Batteries Included&quot;
						</p>
					</div>
				)}
			</div>

			<div className="px-10 xl:px-20">
				<div className="mx-auto lg:max-w-screen-lg xl:max-w-screen-xl px-5 md:px-0 xl:px-0 my-7">
					<h2 className="text-3xl font-bold pl-3 lg:pl-0">What is Included?</h2>
					<div className="mt-5">
						<Features features={base_features} />
					</div>
				</div>
				<div className="mx-auto lg:max-w-screen-lg xl:max-w-screen-xl px-5 md:px-0 xl:px-0 my-7">
					<h2 className="text-3xl font-bold pl-3 lg:pl-0">Agency Friendly</h2>
					<div className="mt-5">
						<Features features={agency_features} />
					</div>
				</div>
			</div>
		</div>
	);
}
