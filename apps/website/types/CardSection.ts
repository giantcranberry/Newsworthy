import { PortableTextBlock } from "sanity";

export type CardSection = {
	_id: string;
	_type: string;
	_createdAt: Date;
	headline: string;
	slug: {
		current: string;
	};
	content: PortableTextBlock[];
	section_type: string;
	sectionCta: {
		ctaLabel: string;
		ctaUrl: string;
	};
	sectionImage: {
		asset: {
			url: string;
		};
		image_type: string;
		alt: string;
		credit: string;
	};
};
