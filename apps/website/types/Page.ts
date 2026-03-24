import { PortableTextBlock } from "sanity";
import { ContentSection } from "./ContentSection";
import { CardSection } from "./CardSection";

export type Page = {
	_id: string;
	_createdAt: Date;
	title: string;
	menu_title: string;
	slug: {
		current: string;
	};
	seo_description: string;
	hero_headline: string;
	hero_text: PortableTextBlock[];
	siteId: string;
	hero_image: {
		asset: {
			url: string;
		};
		alt: string;
		credit: string;
	};
	hero_overlay: string;
	hero_cta: {
		cta_text: string;
		cta_link: string;
	};
	hero_background_css: string;
	hero_button_css: string;
	pageContent: {
		pageContentPlacement: string;
		pageContentHeadline: string;
		formattedPageContent: PortableTextBlock[];
	};
	textContent: string;
	content: PortableTextBlock[];
	sortOrder: number;
	content_sections: ContentSection[];
	card_sections: CardSection[];
	primary_testimonial: {
		_id: string;
		person: string;
		quote: string;
		image: {
			asset: {
				url: string;
			};
			alt: string;
		};
	}[];
};
