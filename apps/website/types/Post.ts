import { PortableTextBlock } from "sanity";

export type Post = {
	_id: string;
	_createdAt: Date;
	headline: string;
	excerpt: string;
	featureOn: Date;
	publishedAt: Date;
	siteId: string;
	slug: {
		current: string;
	};
	coverImage: {
		asset: {
			url: string;
		};
		alt: string;
		credit: string;
	};
	imageUrl: string;
	url: string;
	category: {
		categoryName: string;
		slug: {
			current: string;
		};
	};
	author: {
		name: string;
		slug: {
			current: string;
		};
		shortBio: string;
		linkedin: string;
		image: {
			asset: {
				url: string;
			};
		};
		bio: string;
	};
	content: PortableTextBlock[];
};

export type SitemapUrlSanity = {
	slug: {
		current: string;
	};
	_updatedAt: string;
};
