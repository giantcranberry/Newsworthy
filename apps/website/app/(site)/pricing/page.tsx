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
		<div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 py-5 pb-16 lg:pb-24">
			{/* Hero */}
			<div className="flex flex-col lg:flex-row items-center gap-10 py-16 lg:py-24">
				<div className="flex-1 text-center lg:text-left">
					<p className="text-sm font-medium uppercase tracking-wider text-cyan-700 mb-4">Press Release Distribution</p>
					<h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
						Just <span className="text-cyan-700">$129</span>
					</h1>
					<p className="mt-4 text-lg md:text-xl text-gray-600 max-w-lg mx-auto lg:mx-0">
						{page.hero_headline || "Everything you need to distribute your press release"}
					</p>
					{page.hero_text && (
						<div className="mt-4 prose prose-lg max-w-lg mx-auto lg:mx-0 text-gray-500">
							<PortableText value={page.hero_text} />
						</div>
					)}
					{page.hero_cta.cta_link && (
						<Link
							href={page.hero_cta.cta_link}
							className="inline-block rounded-full bg-cyan-700 hover:bg-cyan-800 text-white font-semibold mt-8 px-8 py-3 transition-colors">
							{page.hero_cta.cta_text}
						</Link>
					)}
				</div>
				{page.hero_image && (
					<div className="flex-1">
						<Image
							className="w-full rounded-xl object-cover"
							src={urlFor(page.hero_image.asset)}
							alt={page.hero_image.alt || "Pricing"}
							width={1200}
							height={464}
						/>
					</div>
				)}
			</div>

			<hr className="border-gray-200" />

			<div className="my-7">
				<h2 className="text-3xl font-bold">What is Included?</h2>
				<div className="mt-5">
					<Features features={base_features} />
				</div>
			</div>
			<div className="my-7">
				<h2 className="text-3xl font-bold">Agency Friendly</h2>
				<div className="mt-5">
					<Features features={agency_features} />
				</div>
			</div>
		</div>
	);
}
