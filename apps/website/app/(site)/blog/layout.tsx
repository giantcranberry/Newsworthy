import "@/app/globals.css";
import { getPages } from "@/sanity/sanity-utils";
import { Metadata } from "next";

export const metadata: Metadata = {
	title: {
		default: "The News Marketing Blog",
		template: `%s | Newsworthy.ai`,
	},
	openGraph: {
		title: "The News Marketing Blog",
		description:
			"Blog posts and useful information from the Newsworthy team and our contributors to help you on your journey to becoming a better News Marketer.",
		images: [
			{
				url: "/nw-social-image.jpg",
				width: 1200,
				height: 630,
			},
			{
				url: "/nw-social-image.jpg",
				width: 1200,
				height: 675,
			},
			{
				url: "/nw-social-image.jpg",
				width: 800,
				height: 418,
			},
		],
	},
};

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pages = await getPages();

	return <div className="bg-white">{children}</div>;
}
