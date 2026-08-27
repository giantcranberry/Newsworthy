import { Rule } from "@sanity/types";

const page = {
	name: "page",
	title: "Pages",
	type: "document",
	fields: [
		{
			name: "title",
			title: "Title",
			type: "string",
			description:
				"This is the head title and will show up in the browser tab, feeds and search results.",
		},
		{
			name: "menu_title",
			title: "Menu Title",
			type: "string",
		},
		{
			name: "slug",
			title: "Slug",
			type: "slug",
			options: { source: "title", maxLength: 96 },
		},
		{
			name: "seo_description",
			title: "SEO Description",
			description:
				"This is the description that will show up site navigation, search results, page Meta tags...",
			type: "string",
			options: { maxLength: 160 },
		},
		{
			name: "siteId",
			title: "Site ID",
			type: "string",
			description:
				"This is the site ID that will be used to determine which site this page belongs to.",
			of: [{ type: "array" }],
			options: {
				list: [
					{ title: "AttentionWorthy.com", value: "attentionworthy" },
					{ title: "CreatorBox.com", value: "creatorbox" },
					{ title: "Feedworthy.ai", value: "feedworthy" },
					{ title: "NewsRamp.com", value: "newsramp" },
					{ title: "Newsworthy.ai", value: "newsworthy" },
					{ title: "Stroodle.news", value: "stroodle" },
					{ title: "Cross Post to All Sites", value: "all" },
				],
				default: ["newsworthy"],
				maxLength: 1,
			},
		},
		{
			name: "hero_headline",
			title: "Hero Headline",
			type: "string",
		},
		{
			name: "hero_text",
			title: "Hero Text",
			type: "array",
			of: [{ type: "block" }],
		},
		{
			name: "hero_image",
			title: "Hero Image",
			type: "image",
			options: { hotspot: true },
			fields: [
				{ name: "alt", title: "Alternative Text", type: "string" },
				{ name: "credit", title: "Image Credits", type: "string" },
			],
		},
		{
			name: "hero_overlay",
			title: "Hero Text Overlay",
			type: "string",
		},
		{
			name: "hero_cta",
			title: "Hero CTA",
			type: "object",
			fields: [
				{
					name: "cta_text",
					title: "CTA Text",
					type: "string",
				},
				{
					name: "cta_link",
					title: "CTA Link",
					type: "url",
					validation: (Rule: Rule) =>
						Rule.uri({
							scheme: ["http", "https", "mailto", "tel"],
						}),
				},
			],
		},
		{
			name: "hero_background_css",
			title: "Hero Background CSS",
			type: "string",
		},
		{
			name: "hero_button_text_css",
			title: "Hero Button Text CSS",
			type: "string",
		},
		{
			name: "hero_button_css",
			title: "Hero Button CSS",
			type: "string",
		},
		{
			name: "pageContent",
			title: "Page Content",
			type: "object",
			fields: [
				{
					name: "pageContentPlacement",
					title: "Page Content Placement",
					type: "string",
					of: [{ type: "array" }],
					options: {
						list: [
							{ title: "Above Content Sections", value: "above" },
							{ title: "Below Content Sections", value: "below" },
						],
						default: ["above"],
						maxLength: 1,
					},
				},
				{
					name: "pageContentHeadline",
					title: "Page Content Headline",
					type: "string",
					options: { maxLength: 160 },
				},
				{
					name: "formattedPageContent",
					title: "Formatted Page Content",
					type: "array",
					of: [{ type: "block" }, { type: "image" }],
				},
			],
		},
		{
			name: "content_sections",
			title: "Content Sections",
			type: "array",
			of: [{ type: "reference", to: { type: "content_section" } }],
		},
		{
			name: "card_sections",
			title: "Card Sections",
			type: "array",
			of: [{ type: "reference", to: { type: "card_section" } }],
		},
		{
			name: "primary_testimonial",
			title: "Primary Testimonial",
			type: "array",
			of: [{ type: "reference", to: { type: "testimonial" } }],
		},
		{
			name: "sortOrder",
			title: "Sort Order",
			type: "number",
		},
		{
			name: "textContent",
			title: "Plain Text Content",
			type: "text",
		},
	],
};

export default page;
