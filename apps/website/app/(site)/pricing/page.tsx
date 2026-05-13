import Features from "@/components/features";
import { getPage, getBannerAdBySlug, urlFor } from "@/sanity/sanity-utils";
import page from "@/sanity/schemas/page";
import { PortableText } from "@portabletext/react";
import { Package, Users, CheckCircle, Star, Zap, Shield, LucideIcon } from "lucide-react";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 60;

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

const iconMap: Record<string, LucideIcon> = {
	"package": Package,
	"users": Users,
	"check-circle": CheckCircle,
	"star": Star,
	"zap": Zap,
	"shield": Shield,
};

export default async function ContactPage() {
	const [page, bannerAd] = await Promise.all([
		getPage("pricing"),
		getBannerAdBySlug("news-marketing-book"),
	]);

	return (
		<div>
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

			{page.feature_sections?.map((section, index) => {
				const Icon = section.icon ? iconMap[section.icon] : null;
				return (
					<div key={index} className="mt-16 mb-7">
						<h2 className="text-3xl font-bold flex items-center gap-3">
							{Icon && <Icon className="h-8 w-8 text-cyan-700" />}
							{section.heading}
						</h2>
						<div className="mt-5">
							<Features features={section.features} />
						</div>
					</div>
				);
			})}
		</div>
		</div>
	);
}
